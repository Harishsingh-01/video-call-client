import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://video-call-server-hrml.onrender.com", {
  transports: ["websocket", "polling"],
  withCredentials: true
});

const roomId = "test-room";
socket.emit("join-room", roomId);

export default function VideoCall() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);

  const [callStarted, setCallStarted] = useState(false);

  useEffect(() => {
    socket.on("user-connected", (userId) => {
      console.log(`User ${userId} joined the room`);
    });

    socket.on("offer", async (offer) => {
      console.log("Received offer", offer);
      if (!peerConnection.current) createPeerConnection();
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", answer);
    });

    socket.on("answer", async (answer) => {
      console.log("Received answer", answer);
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("ice-candidate", async (candidate) => {
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => socket.disconnect();
  }, []);

  function createPeerConnection() {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
      }
    };

    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
  }

  async function startCall() {
    setCallStarted(true);
    createPeerConnection();

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("offer", offer);
    console.log("Sending offer to the second user.");
  }

  return (
    <div>
      <h2>Video Call</h2>
      <video ref={localVideoRef} autoPlay playsInline muted />
      <video ref={remoteVideoRef} autoPlay playsInline />
      {!callStarted && <button onClick={startCall}>Start Call</button>}
    </div>
  );
}

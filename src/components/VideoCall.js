import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://video-call-server-hrml.onrender.com"); // Use your Cloudflare URL

const VideoCall = () => {
  const localVideoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [inputRoom, setInputRoom] = useState("");
  const [currentCamera, setCurrentCamera] = useState("user");
  const peersRef = useRef({}); // Store multiple peer connections
  const videoRefs = useRef({}); // Store video refs for remote users

  useEffect(() => {
    socket.on("user-connected", (userId) => {
      console.log(`User ${userId} joined the room`);
      callUser(userId);
    });

    socket.on("signal", async ({ senderId, signal }) => {
      if (!peersRef.current[senderId]) {
        setupPeer(senderId);
      }

      try {
        if (signal.type === "offer") {
          await peersRef.current[senderId].setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await peersRef.current[senderId].createAnswer();
          await peersRef.current[senderId].setLocalDescription(answer);
          socket.emit("signal", { room: roomId, senderId: socket.id, signal: answer });
        } else if (signal.type === "answer") {
          await peersRef.current[senderId].setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          await peersRef.current[senderId].addIceCandidate(new RTCIceCandidate(signal));
        }
      } catch (error) {
        console.error("Error handling WebRTC signal:", error);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  const setupPeer = (userId) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.ontrack = (event) => {
      if (!videoRefs.current[userId]) {
        videoRefs.current[userId] = document.createElement("video");
        videoRefs.current[userId].autoPlay = true;
        videoRefs.current[userId].playsInline = true;
        videoRefs.current[userId].classList.add("w-1/2", "border", "border-gray-700");
        document.getElementById("remote-videos").appendChild(videoRefs.current[userId]);
      }
      videoRefs.current[userId].srcObject = event.streams[0];
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { room: roomId, senderId: socket.id, signal: event.candidate });
      }
    };

    stream?.getTracks().forEach((track) => peer.addTrack(track, stream));

    peersRef.current[userId] = peer;
  };

  const callUser = async (userId) => {
    if (!peersRef.current[userId]) setupPeer(userId);

    const offer = await peersRef.current[userId].createOffer();
    await peersRef.current[userId].setLocalDescription(offer);

    socket.emit("signal", { room: roomId, senderId: socket.id, signal: offer });
  };

  const getMediaStream = () => {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentCamera },
      audio: true,
    })
    .then((userStream) => {
      setStream(userStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = userStream;
      }
    })
    .catch(err => console.error("Error accessing camera:", err));
  };

  const switchCamera = () => {
    const newCamera = currentCamera === "user" ? "environment" : "user";
    setCurrentCamera(newCamera);
    getMediaStream();
  };

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 10);
    setRoomId(newRoomId);
    socket.emit("join-room", newRoomId);
    setJoinedRoom(true);
    getMediaStream();
  };

  const joinRoom = () => {
    if (inputRoom) {
      setRoomId(inputRoom);
      socket.emit("join-room", inputRoom);
      setJoinedRoom(true);
      getMediaStream();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      {!joinedRoom ? (
        <div className="flex flex-col gap-4">
          <button onClick={createRoom} className="px-4 py-2 bg-blue-500 rounded">
            Create Room
          </button>
          <input
            type="text"
            placeholder="Enter Room Code"
            value={inputRoom}
            onChange={(e) => setInputRoom(e.target.value)}
            className="px-4 py-2 text-black"
          />
          <button onClick={joinRoom} className="px-4 py-2 bg-green-500 rounded">
            Join Room
          </button>
        </div>
      ) : (
        <>
          <p>Room Code: {roomId}</p>
          <div className="flex gap-4">
            <video ref={localVideoRef} autoPlay playsInline className="w-1/2 border border-gray-700" />
          </div>
          <div id="remote-videos" className="flex gap-4 mt-4"></div>
          <div className="mt-4 flex gap-4">
            <button onClick={switchCamera} className="px-4 py-2 bg-yellow-500 rounded">
              Switch Camera
            </button>
      </div>
        </>
        )}
    </div>
  );
};

export default VideoCall;

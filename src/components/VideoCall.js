import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://barnes-occasions-kw-portfolio.trycloudflare.com"); // Use your Cloudflare URL

const VideoCall = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [inputRoom, setInputRoom] = useState("");
  const [currentCamera, setCurrentCamera] = useState("user"); // Default: Front Camera

  useEffect(() => {
    socket.on("user-connected", (userId) => {
      console.log(`User ${userId} joined the room`);
      callUser(userId);
    });

    socket.on("signal", async (data) => {
      if (!peerRef.current) setupPeer();

      if (data.type === "offer") {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit("signal", { room: roomId, answer });
      } else if (data.type === "answer") {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } else if (data.candidate) {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  const setupPeer = () => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { room: roomId, candidate: event.candidate });
      }
    };

    peerRef.current = peer;
  };

  const callUser = async (userId) => {
    if (!peerRef.current) setupPeer();

    const offer = await peerRef.current.createOffer();
    await peerRef.current.setLocalDescription(offer);

    socket.emit("signal", { room: roomId, offer });
  };

  const getMediaStream = (facingMode = "user") => {
    navigator.mediaDevices.getUserMedia({ 
      video: { facingMode }, 
      audio: true 
    })
    .then((userStream) => {
      setStream(userStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = userStream;
      }
      if (peerRef.current) {
        userStream.getTracks().forEach((track) => peerRef.current.addTrack(track, userStream));
      }
    })
    .catch((err) => console.error("Error accessing media devices:", err));
  };

  const switchCamera = () => {
    const newCamera = currentCamera === "user" ? "environment" : "user";
    setCurrentCamera(newCamera);
    getMediaStream(newCamera);
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
            <video ref={remoteVideoRef} autoPlay playsInline className="w-1/2 border border-gray-700" />
          </div>
          <div className="mt-4 flex gap-4">
            <button onClick={callUser} className="px-4 py-2 bg-red-500 rounded">
              Start Call
            </button>
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

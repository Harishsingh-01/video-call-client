import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://video-call-server-hrml.onrender.com");

const VideoCall = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [inputRoom, setInputRoom] = useState("");
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!roomId) return;

    socket.on("room-joined", (data) => console.log("Joined room:", data));

    socket.on("user-connected", (userId) => {
      console.log(`User ${userId} joined`);
      setTimeout(() => callUser(userId), 1000);
    });

    socket.on("signal", async (data) => {
      console.log("Received signal:", data);
      if (!peerRef.current) {
        setupPeer();
        stream?.getTracks().forEach((track) => peerRef.current.addTrack(track, stream));
      }

      try {
        if (data.offer) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerRef.current.createAnswer();
          await peerRef.current.setLocalDescription(answer);
          socket.emit("signal", { room: roomId, type: "answer", answer });
        } else if (data.answer) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.candidate) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (error) {
        console.error("Signal processing error:", error);
      }
    });

    socket.on("user-disconnected", () => {
      console.log("User left the room");
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
    });

    return () => {
      socket.off("room-joined");
      socket.off("user-connected");
      socket.off("user-disconnected");
      socket.off("signal");
    };
  }, [roomId, stream]);

  const setupPeer = () => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // Free STUN server
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "efW7ayV8vc62c",
          credential: "oJ1Nq1hBf6j9A",
        },
      ],
    });

    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { room: roomId, type: "candidate", candidate: event.candidate });
      }
    };

    peerRef.current = peer;
  };

  const callUser = async (userId) => {
    if (!peerRef.current) setupPeer();

    stream?.getTracks().forEach((track) => peerRef.current.addTrack(track, stream));

    const offer = await peerRef.current.createOffer();
    await peerRef.current.setLocalDescription(offer);

    socket.emit("signal", { room: roomId, type: "offer", offer });
  };

  const getMediaStream = async () => {
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(userStream);
      if (localVideoRef.current) localVideoRef.current.srcObject = userStream;
    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 10);
    setRoomId(newRoomId);
    socket.emit("join-room", newRoomId);
    setJoinedRoom(true);
    getMediaStream();
  };

  const joinRoom = () => {
    if (!inputRoom) return alert("Enter a room code");
    setRoomId(inputRoom);
    socket.emit("join-room", inputRoom);
    setJoinedRoom(true);
    getMediaStream();
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <div className={`fixed top-4 right-4 px-3 py-1 rounded ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}>
        {isConnected ? "Connected" : "Disconnected"}
      </div>

      {!joinedRoom ? (
        <div className="flex flex-col gap-4">
          <button onClick={createRoom} className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">
            Create Room
          </button>
          <input
            type="text"
            placeholder="Enter Room Code"
            value={inputRoom}
            onChange={(e) => setInputRoom(e.target.value)}
            className="px-4 py-2 text-black rounded"
          />
          <button onClick={joinRoom} className="px-4 py-2 bg-green-500 rounded hover:bg-green-600">
            Join Room
          </button>
        </div>
      ) : (
        <>
          <p className="mb-4">Room Code: {roomId}</p>
          <div className="flex gap-4">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-80 h-60 border rounded bg-black" />
            <video ref={remoteVideoRef} autoPlay playsInline className="w-80 h-60 border rounded bg-black" />
          </div>
        </>
      )}
    </div>
  );
};

export default VideoCall;

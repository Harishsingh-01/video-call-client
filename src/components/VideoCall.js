import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// Initialize socket connection
const socket = io("https://video-call-server-hrml.onrender.com");

const VideoCall = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [inputRoom, setInputRoom] = useState("");
  const [currentCamera, setCurrentCamera] = useState("user");
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;

    socket.on("room-joined", (data) => {
      console.log("Joined room:", data);
    });

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
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
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

  const getMediaStream = (facingMode = "user") => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode }, audio: true })
      .then((userStream) => {
        setStream(userStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = userStream;
        peerRef.current?.getSenders().forEach((sender) => peerRef.current.removeTrack(sender));
        userStream.getTracks().forEach((track) => peerRef.current?.addTrack(track, userStream));
      })
      .catch((err) => console.error("Media error:", err));
  };

  const switchCamera = () => {
    stream?.getTracks().forEach((track) => track.stop());
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
            <div className="relative">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-80 h-60 border rounded bg-black" />
              <span className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 rounded">You</span>
            </div>
            <div className="relative">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-80 h-60 border rounded bg-black" />
              <span className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 rounded">Remote</span>
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <button onClick={switchCamera} className="px-4 py-2 bg-yellow-500 rounded hover:bg-yellow-600">
              Switch Camera
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoCall;

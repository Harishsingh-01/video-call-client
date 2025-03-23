import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// Initialize socket connection
const socket = io("https://video-call-server-hrml.onrender.com");

const VideoCall = () => {
  // Refs for video elements and peer connection
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  // State management
  const [stream, setStream] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [inputRoom, setInputRoom] = useState("");
  const [currentCamera, setCurrentCamera] = useState("user"); // "user" for front camera, "environment" for back camera

  // Handle socket connections and signaling
  useEffect(() => {
    // Listen for new user connections
    socket.on("user-connected", (userId) => {
      console.log(`User ${userId} joined the room`);
      callUser(userId);
    });

    // Handle WebRTC signaling
    socket.on("signal", async (data) => {
      if (!peerRef.current) setupPeer();

      try {
        if (data.type === "offer") {
          // Handle incoming call offer
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerRef.current.createAnswer();
          await peerRef.current.setLocalDescription(answer);
          socket.emit("signal", { room: roomId, answer });
        } else if (data.type === "answer") {
          // Handle call answer
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.candidate) {
          // Handle ICE candidates
          await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (error) {
        console.error("Signal error:", error);
      }
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  // Setup WebRTC peer connection
  const setupPeer = () => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ],
    });

    // Handle incoming video/audio streams
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { room: roomId, candidate: event.candidate });
      }
    };

    peerRef.current = peer;
  };

  // Initiate call to another user
  const callUser = async (userId) => {
    if (!peerRef.current) setupPeer();

    try {
      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      socket.emit("signal", { room: roomId, offer });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  // Get camera and microphone stream
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
      // Add tracks to peer connection if it exists
      if (peerRef.current) {
        userStream.getTracks().forEach((track) => {
          peerRef.current.addTrack(track, userStream);
        });
      }
    })
    .catch((err) => {
      console.error("Error accessing media devices:", err);
      alert("Unable to access camera/microphone. Please check permissions.");
    });
  };

  // Switch between front and back cameras
  const switchCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    const newCamera = currentCamera === "user" ? "environment" : "user";
    setCurrentCamera(newCamera);
    getMediaStream(newCamera);
  };

  // Create a new room
  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 10);
    setRoomId(newRoomId);
    socket.emit("join-room", newRoomId);
    setJoinedRoom(true);
    getMediaStream();
  };

  // Join an existing room
  const joinRoom = () => {
    if (inputRoom) {
      setRoomId(inputRoom);
      socket.emit("join-room", inputRoom);
      setJoinedRoom(true);
      getMediaStream();
    } else {
      alert("Please enter a room code");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
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
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-80 h-60 border border-gray-700 rounded bg-black"
              />
              <span className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 rounded">You</span>
            </div>
            <div className="relative">
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="w-80 h-60 border border-gray-700 rounded bg-black"
              />
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

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

  // Split the socket connection handling into a separate useEffect
  useEffect(() => {
    console.log('Initial socket setup');
    
    socket.on("connect", () => {
      console.log("Socket connected successfully");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    // Cleanup only on component unmount
    return () => {
      console.log("Component unmounting, cleaning up socket...");
      socket.disconnect();
    };
  }, []); // Empty dependency array

  // Handle room-specific socket events
  useEffect(() => {
    if (!roomId) return;

    console.log(`Setting up room handlers for room: ${roomId}`);

    // Add this to track room joining confirmation
    socket.on("room-joined", (data) => {
      console.log("Successfully joined room:", data);
    });

    socket.on("user-connected", (userId) => {
      console.log(`User ${userId} joined the room. Initiating call...`);
      // Add delay to ensure peer setup is complete
      setTimeout(() => {
        callUser(userId);
      }, 1000);
    });

    // Update signal handler
    socket.on("signal", async (data) => {
      console.log("Received signal:", data);
      
      if (!peerRef.current) {
        console.log("Setting up new peer connection...");
        setupPeer();
        
        // If we have a stream, add tracks to the new peer
        if (stream) {
          console.log("Adding existing tracks to new peer connection");
          stream.getTracks().forEach((track) => {
            peerRef.current.addTrack(track, stream);
          });
        }
      }

      try {
        if (data.offer) {
          console.log("Processing offer...");
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          console.log("Created remote description");
          
          const answer = await peerRef.current.createAnswer();
          console.log("Created answer");
          
          await peerRef.current.setLocalDescription(answer);
          console.log("Set local description");
          
          socket.emit("signal", { 
            room: roomId,
            to: data.from, // Add this
            type: "answer",
            answer 
          });
          console.log("Sent answer to peer");
        } else if (data.answer) {
          console.log("Processing answer...");
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log("Set remote description from answer");
        } else if (data.candidate) {
          console.log("Processing ICE candidate...");
          await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log("Added ICE candidate");
        }
      } catch (error) {
        console.error("Signal processing error:", error);
      }
    });

    // Add this to track when users leave
    socket.on("user-disconnected", (userId) => {
      console.log(`User ${userId} left the room`);
    });

    return () => {
      console.log(`Cleaning up room handlers for room: ${roomId}`);
      socket.off("room-joined");
      socket.off("user-connected");
      socket.off("user-disconnected");
      socket.off("signal");
    };
  }, [roomId, stream]); // Add stream to dependencies

  // Setup WebRTC peer connection
  const setupPeer = () => {
    console.log("Setting up peer connection...");
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com'
        }
      ],
    });

    peer.oniceconnectionstatechange = () => {
      console.log("ICE Connection State:", peer.iceConnectionState);
    };

    peer.onconnectionstatechange = () => {
      console.log("Connection State:", peer.connectionState);
    };

    peer.onnegotiationneeded = async () => {
      console.log("Negotiation needed");
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("signal", { 
          room: roomId, 
          type: "offer",
          offer 
        });
      } catch (err) {
        console.error("Error during negotiation:", err);
      }
    };

    peer.ontrack = (event) => {
      console.log("Received remote track:", event.streams[0].getTracks());
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        console.log("Set remote video stream");
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Generated ICE candidate");
        socket.emit("signal", { 
          room: roomId,
          type: "candidate",
          candidate: event.candidate 
        });
        console.log("Sent ICE candidate to peer");
      }
    };

    peerRef.current = peer;
    console.log("Peer connection setup complete");
  };

  // Initiate call to another user
  const callUser = async (userId) => {
    console.log("Initiating call to user:", userId);
    
    if (!peerRef.current) {
      console.log("Setting up peer connection for call...");
      setupPeer();
    }

    // Add tracks if we have a stream
    if (stream) {
      console.log("Adding tracks to peer connection");
      stream.getTracks().forEach((track) => {
        peerRef.current.addTrack(track, stream);
      });
    }

    try {
      console.log("Creating offer...");
      const offer = await peerRef.current.createOffer();
      console.log("Setting local description...");
      await peerRef.current.setLocalDescription(offer);
      console.log("Sending offer to peer...");
      socket.emit("signal", { 
        room: roomId,
        to: userId, // Add this
        type: "offer",
        offer 
      });
    } catch (error) {
      console.error("Error during call initiation:", error);
    }
  };

  // Get camera and microphone stream
  const getMediaStream = (facingMode = "user") => {
    console.log("Getting media stream with facing mode:", facingMode);
    
    navigator.mediaDevices.getUserMedia({ 
      video: { facingMode },
      audio: true 
    })
    .then((userStream) => {
      console.log("Got media stream:", userStream.getTracks());
      setStream(userStream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = userStream;
        console.log("Set local video stream");
      }
      
      if (peerRef.current) {
        console.log("Adding tracks to peer connection...");
        userStream.getTracks().forEach((track) => {
          peerRef.current.addTrack(track, userStream);
          console.log("Added track:", track.kind);
        });
      }
    })
    .catch((err) => {
      console.error("Media stream error:", err);
      alert("Unable to access camera/microphone. Please check permissions.");
    });
  };

  // Switch between front and back cameras
  const switchCamera = () => {
    console.log("Switching camera...");
    if (stream) {
      console.log("Stopping current tracks...");
      stream.getTracks().forEach(track => track.stop());
    }
    const newCamera = currentCamera === "user" ? "environment" : "user";
    console.log("Switching to camera mode:", newCamera);
    setCurrentCamera(newCamera);
    getMediaStream(newCamera);
  };

  // Update createRoom function
  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 10);
    console.log("Creating new room:", newRoomId);
    
    // Make sure we're connected before creating room
    if (!socket.connected) {
      console.log("Reconnecting socket...");
      socket.connect();
    }
    
    setRoomId(newRoomId);
    socket.emit("join-room", newRoomId);
    console.log("Emitted join-room event");
    setJoinedRoom(true);
    getMediaStream();
  };

  // Update joinRoom function
  const joinRoom = () => {
    if (inputRoom) {
      console.log("Joining room:", inputRoom);
      
      // Make sure we're connected before joining room
      if (!socket.connected) {
        console.log("Reconnecting socket...");
        socket.connect();
      }
      
      setRoomId(inputRoom);
      socket.emit("join-room", inputRoom);
      console.log("Emitted join-room event");
      setJoinedRoom(true);
      getMediaStream();
    } else {
      console.warn("No room code entered");
      alert("Please enter a room code");
    }
  };

  // Add connection status display
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const handleConnect = () => {
      console.log('Socket connected');
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      {/* Add connection status indicator */}
      <div className={`fixed top-4 right-4 px-3 py-1 rounded ${
        isConnected ? 'bg-green-500' : 'bg-red-500'
      }`}>
        {isConnected ? 'Connected' : 'Disconnected'}
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

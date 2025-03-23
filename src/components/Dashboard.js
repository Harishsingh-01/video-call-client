import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login"); // Redirect to login after logout
  };

  const startCall = () => {
    navigate("/videocall"); // Navigate to the video call page
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center w-96">
        <h2 className="text-2xl font-bold mb-4">Welcome to Dashboard</h2>
        <p className="text-gray-700 mb-6">Start a one-to-one video call.</p>

        <button
          onClick={startCall}
          className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600 mb-4"
        >
          Start Video Call
        </button>

        <button
          onClick={handleLogout}
          className="w-full bg-red-500 text-white p-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Dashboard;

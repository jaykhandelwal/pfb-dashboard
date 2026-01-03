
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { Camera, CheckCircle2, UserCheck, MapPin, Loader2, X, RotateCcw } from 'lucide-react';
import { uploadImageToBunny } from '../services/bunnyStorage';
import { getLocalISOString } from '../constants';

const Attendance: React.FC = () => {
  const { branches, addAttendance, attendanceRecords } = useStore();
  const { currentUser } = useAuth();
  
  const [branchId, setBranchId] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Initialize Branch ID based on User Default
  useEffect(() => {
    if (currentUser?.defaultBranchId && branches.some(b => b.id === currentUser.defaultBranchId)) {
       setBranchId(currentUser.defaultBranchId);
    } else if (branches.length > 0) {
       setBranchId(branches[0].id);
    }
  }, [currentUser, branches]);

  // Check if already checked in today
  const today = getLocalISOString();
  const todayRecord = attendanceRecords.find(r => r.userId === currentUser?.id && r.date === today);

  // Camera Functions
  const startCamera = async () => {
    try {
      setErrorMsg('');
      let mediaStream: MediaStream;

      try {
         // Attempt 1: Explicitly request front camera
         mediaStream = await navigator.mediaDevices.getUserMedia({ 
           video: { facingMode: 'user' } 
         });
      } catch (e) {
         console.warn("Front camera request failed, falling back to any video device", e);
         // Fallback: Any available video device
         mediaStream = await navigator.mediaDevices.getUserMedia({ 
           video: true 
         });
      }

      setStream(mediaStream);
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera Error:", err);
      setErrorMsg("Could not access camera. Please allow camera permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        // Flip horizontally for selfie mirror effect
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6); 
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleSubmit = async () => {
    if (!capturedImage) {
      setErrorMsg("Please take a photo to confirm attendance.");
      return;
    }
    if (!currentUser) return;

    setIsSubmitting(true);

    try {
      // Upload image to 'attendance' folder
      const imageUrl = await uploadImageToBunny(capturedImage, 'attendance');

      await addAttendance({
         userId: currentUser.id,
         userName: currentUser.name,
         branchId,
         date: today,
         timestamp: Date.now(),
         imageUrl
      });

      setSuccessMsg(`Checked in successfully at ${new Date().toLocaleTimeString()}!`);
      setCapturedImage(null);
    } catch (e) {
      setErrorMsg("Failed to submit attendance. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (todayRecord) {
     return (
        <div className="max-w-md mx-auto pt-10 px-4 text-center">
           <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-8">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                 <CheckCircle2 size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">You're Checked In!</h2>
              <p className="text-slate-500 mb-6">Attendance recorded for today.</p>
              
              <div className="bg-slate-50 rounded-xl p-4 text-left text-sm space-y-3">
                 <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500">Date</span>
                    <span className="font-bold text-slate-700">{todayRecord.date}</span>
                 </div>
                 <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500">Time</span>
                    <span className="font-bold text-slate-700">{new Date(todayRecord.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-500">Branch</span>
                    <span className="font-bold text-slate-700">
                       {branches.find(b => b.id === todayRecord.branchId)?.name || 'Unknown'}
                    </span>
                 </div>
              </div>
           </div>
        </div>
     )
  }

  return (
    <div className="max-w-md mx-auto pb-20">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <UserCheck className="text-indigo-600" /> Staff Attendance
        </h2>
        <p className="text-slate-500">Verify your location and check in.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         {/* Branch Selection */}
         <div className="p-5 border-b border-slate-100">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
               <MapPin size={12} /> Select Location
            </label>
            <select
               value={branchId}
               onChange={(e) => setBranchId(e.target.value)}
               className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
               {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
               ))}
            </select>
         </div>

         {/* Camera Section */}
         <div className="p-5 flex flex-col items-center">
            {/* Hidden canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {!isCameraOpen && !capturedImage && (
               <button
                  onClick={startCamera}
                  className="w-full aspect-square md:aspect-video rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
               >
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                     <Camera size={32} />
                  </div>
                  <span className="font-bold text-sm">Tap to Take Selfie</span>
               </button>
            )}

            {isCameraOpen && (
              <div className="relative w-full aspect-[3/4] md:aspect-video bg-black rounded-xl overflow-hidden shadow-lg flex flex-col">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover flex-1 scale-x-[-1]"
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                   <button 
                    onClick={stopCamera}
                    className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-bold"
                   >
                     Cancel
                   </button>
                   <button 
                    onClick={capturePhoto}
                    className="w-14 h-14 bg-white rounded-full border-4 border-slate-200 shadow-lg active:scale-95 transition-transform"
                   />
                </div>
              </div>
            )}

            {capturedImage && (
               <div className="w-full">
                  <div className="relative aspect-[3/4] md:aspect-video bg-slate-100 rounded-xl overflow-hidden mb-4 border border-slate-200">
                     <img src={capturedImage} alt="Selfie" className="w-full h-full object-cover" />
                     <button 
                       onClick={() => setCapturedImage(null)}
                       className="absolute top-2 right-2 bg-slate-800/50 text-white p-2 rounded-full hover:bg-slate-800"
                     >
                       <RotateCcw size={16} />
                     </button>
                  </div>
                  
                  {errorMsg && (
                     <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center mb-4 flex items-center justify-center gap-2">
                        <X size={16} /> {errorMsg}
                     </div>
                  )}

                  <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                     {isSubmitting ? (
                        <>
                           <Loader2 size={20} className="animate-spin" /> Checking In...
                        </>
                     ) : (
                        <>
                           <CheckCircle2 size={20} /> Confirm Attendance
                        </>
                     )}
                  </button>
               </div>
            )}
         </div>
      </div>
      
      {successMsg && (
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-lg text-center font-bold animate-fade-in-up flex items-center justify-center gap-2">
            <CheckCircle2 size={24} />
            {successMsg}
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;

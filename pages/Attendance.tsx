
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
   const [capturedImage, setCapturedImage] = useState<string | null>(null); // Current stage image
   const [collectedImages, setCollectedImages] = useState<string[]>([]); // All stage images
   const [currentStageIndex, setCurrentStageIndex] = useState(0);

   const [isCameraOpen, setIsCameraOpen] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [successMsg, setSuccessMsg] = useState('');
   const [errorMsg, setErrorMsg] = useState('');

   const videoRef = useRef<HTMLVideoElement>(null);
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const [stream, setStream] = useState<MediaStream | null>(null);

   // Staged Attendance Config for Current User
   const isStaged = currentUser?.isStagedAttendanceEnabled && currentUser?.stagedAttendanceConfig && currentUser.stagedAttendanceConfig.length > 0;
   const stages = isStaged ? currentUser.stagedAttendanceConfig! : [];
   const currentStage = isStaged ? stages[currentStageIndex] : null;

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

         // Determine facing mode: 'user' (front) or 'environment' (back)
         // Default to 'user' for unstaged or if not specified
         const facingMode = currentStage?.cameraFacingMode || 'user';

         try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
               video: { facingMode }
            });
         } catch (e) {
            console.warn(`Camera request for ${facingMode} failed, trying fallback`, e);
            // Fallback to any video device
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
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
            // Mirror only if using front camera (implied by 'user' mode or default)
            const isFrontCamera = !currentStage || currentStage.cameraFacingMode === 'user';

            if (isFrontCamera) {
               context.translate(canvas.width, 0);
               context.scale(-1, 1);
            }

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

   const handleStageNext = () => {
      if (!capturedImage) return;

      const newImages = [...collectedImages, capturedImage];
      setCollectedImages(newImages);
      setCapturedImage(null);

      if (currentStageIndex < stages.length - 1) {
         // Move to next stage
         setCurrentStageIndex(prev => prev + 1);
      } else {
         // All stages done, trigger submit
         submitAttendance(newImages);
      }
   };

   const handleRetake = () => {
      setCapturedImage(null);
      // collectedImages remains same for current stage index
   };

   const handleSubmitUnstaged = () => {
      if (!capturedImage) {
         setErrorMsg("Please take a photo.");
         return;
      }
      submitAttendance([capturedImage]);
   };

   const submitAttendance = async (imagesToSubmit: string[]) => {
      if (!currentUser) return;
      setIsSubmitting(true);

      try {
         // Upload all images
         const uploadPromises = imagesToSubmit.map((img, idx) =>
            uploadImageToBunny(img, `attendance/${currentUser.id}/${today}/${idx}`)
         );

         const uploadedUrls = await Promise.all(uploadPromises);

         await addAttendance({
            userId: currentUser.id,
            userName: currentUser.name,
            branchId,
            date: today,
            timestamp: Date.now(),
            imageUrl: uploadedUrls[0], // Primary image for backward compatibility
            imageUrls: uploadedUrls
         });

         setSuccessMsg(`Checked in successfully at ${new Date().toLocaleTimeString()}!`);
         setCapturedImage(null);
         setCollectedImages([]);
         setCurrentStageIndex(0);
      } catch (e) {
         console.error("Attendance Submit Error", e);
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
                     <span className="font-bold text-slate-700">{new Date(todayRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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

   // --- RENDER ---

   return (
      <div className="max-w-md mx-auto pb-20">
         <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
               <UserCheck className="text-indigo-600" /> Staff Attendance
            </h2>
            <p className="text-slate-500">Verify your location and check in.</p>
         </div>

         <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Branch Selection (Only show on first stage if staged) */}
            {(!isStaged || currentStageIndex === 0) && (
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
            )}

            {/* Staged Progress Indicator - Visual Slots */}
            {isStaged && (
               <div className="px-5 pt-5 pb-0">
                  <div className="flex gap-2 mb-4 justify-center">
                     {stages.map((stage, idx) => {
                        const isCompleted = idx < currentStageIndex;
                        const isCurrent = idx === currentStageIndex;
                        const isPending = idx > currentStageIndex;

                        return (
                           <div
                              key={stage.id}
                              className={`relative flex-1 aspect-[3/4] max-w-[80px] rounded-lg border-2 overflow-hidden transition-all duration-300 ${isCurrent
                                    ? 'border-indigo-500 ring-2 ring-indigo-200 ring-offset-2 scale-105 z-10'
                                    : isCompleted
                                       ? 'border-emerald-500 bg-emerald-50'
                                       : 'border-slate-200 bg-slate-50 opacity-60'
                                 }`}
                           >
                              {isCompleted && collectedImages[idx] ? (
                                 <div className="w-full h-full relative">
                                    <img src={collectedImages[idx]} className="w-full h-full object-cover" alt="" />
                                    <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                       <div className="bg-emerald-500 text-white rounded-full p-0.5">
                                          <CheckCircle2 size={12} strokeWidth={3} />
                                       </div>
                                    </div>
                                 </div>
                              ) : (
                                 <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                                    <Camera size={20} className={isCurrent ? 'text-indigo-400 animate-pulse' : ''} />
                                    <span className="text-[10px] font-bold mt-1">{idx + 1}</span>
                                 </div>
                              )}

                              {/* Connector Line */}
                              {idx < stages.length - 1 && (
                                 <div className="absolute top-1/2 -right-3 w-4 h-0.5 bg-slate-200 -z-10 hidden" />
                              )}
                           </div>
                        );
                     })}
                  </div>

                  <div className="text-center mb-2">
                     <h3 className="text-lg font-bold text-slate-800 flex items-center justify-center gap-2">
                        {currentStage?.title}
                        <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-wider">
                           {currentStageIndex + 1}/{stages.length}
                        </span>
                     </h3>
                     <p className="text-xs text-slate-500 animate-pulse">
                        {currentStageIndex < stages.length - 1 ? 'More photos required to submit' : 'Final photo'}
                     </p>
                  </div>
               </div>
            )}

            {/* Camera Section */}
            <div className="p-5 flex flex-col items-center">
               <canvas ref={canvasRef} className="hidden" />

               {!isCameraOpen && !capturedImage && (
                  <div className="w-full">
                     <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                           <Camera size={12} /> Camera Verification
                        </span>
                        {!isStaged && (
                           <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100 uppercase tracking-wider">
                              Photo Mandatory
                           </span>
                        )}
                     </div>

                     <button
                        onClick={startCamera}
                        className="w-full aspect-square md:aspect-video rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all group mb-4"
                     >
                        <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                           <Camera size={32} />
                        </div>
                        <span className="font-bold text-sm">Tap to Take Photo</span>
                     </button>

                     <button
                        disabled={true}
                        className="w-full py-3.5 bg-slate-100 text-slate-400 rounded-xl font-bold border border-slate-200 cursor-not-allowed flex items-center justify-center gap-2"
                     >
                        <CheckCircle2 size={20} />
                        {isStaged ? (currentStageIndex === stages.length - 1 ? "Finish & Submit" : "Next Step") : "Take Photo to Check In"}
                     </button>
                  </div>
               )}

               {isCameraOpen && (
                  <div className="relative w-full aspect-[3/4] md:aspect-video bg-black rounded-xl overflow-hidden shadow-lg flex flex-col">
                     <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover flex-1 ${currentStage?.cameraFacingMode !== 'environment' ? 'scale-x-[-1]' : ''}`}
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
                        <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                        <button
                           onClick={handleRetake}
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
                        onClick={isStaged ? handleStageNext : handleSubmitUnstaged}
                        disabled={isSubmitting}
                        className={`w-full py-3.5 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${isStaged && currentStageIndex < stages.length - 1
                           ? 'bg-blue-600 hover:bg-blue-700 text-white'
                           : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                           }`}
                     >
                        {isSubmitting ? (
                           <>
                              <Loader2 size={20} className="animate-spin" /> {isStaged && currentStageIndex < stages.length - 1 ? 'Processing...' : 'Checking In...'}
                           </>
                        ) : (
                           <>
                              {isStaged && currentStageIndex < stages.length - 1 ? (
                                 <>Next: {stages[currentStageIndex + 1]?.title} <CheckCircle2 size={20} /></>
                              ) : (
                                 <><CheckCircle2 size={20} /> Confirm Attendance</>
                              )}
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

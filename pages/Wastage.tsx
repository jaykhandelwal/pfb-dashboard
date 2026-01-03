
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { TransactionType, SKUCategory, SKUDietary, SKU } from '../types';
import { Trash2, Calendar, Store, AlertTriangle, Camera, X, Search, ChevronDown, ChevronUp, Snowflake, CheckCircle2, Loader2 } from 'lucide-react';
import { getLocalISOString } from '../constants';
import { uploadImageToBunny } from '../services/bunnyStorage';

const Wastage: React.FC = () => {
  const { branches, skus, addBatchTransactions } = useStore();
  const { currentUser } = useAuth();
  
  // Form State
  const [date, setDate] = useState<string>(getLocalISOString());
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConsumablesOpen, setIsConsumablesOpen] = useState(false);
  
  // Store quantities as just number string (Loose pieces only)
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Camera State
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Modal State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-expand consumables when searching
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setIsConsumablesOpen(true);
    }
  }, [searchQuery]);

  const handleInputChange = (skuId: string, value: string) => {
    setInputs(prev => ({
      ...prev,
      [skuId]: value
    }));
    if (errorMsg) setErrorMsg('');
  };

  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(getLocalISOString(d));
  };

  // Camera Functions
  const startCamera = async () => {
    try {
      setErrorMsg('');
      let mediaStream: MediaStream;
      
      try {
        // Attempt 1: Force back camera (Mobile) using 'exact' constraint
        // This usually solves the issue where some phones default to front camera even with 'environment'
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: { exact: 'environment' } } 
        });
      } catch (err) {
        console.log("Back camera strict mode failed, trying loose mode...", err);
        // Attempt 2: Fallback to loose preference (Desktop/Laptop or unsupported)
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
      }

      setStream(mediaStream);
      setIsCameraOpen(true);
      // Allow react render cycle to place the video element before attaching stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera Error:", err);
      setErrorMsg("Could not access camera. Please allow camera permissions in your browser settings.");
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
      
      // Set canvas dimensions to match video stream
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Compress slightly to 0.7 quality jpeg to save space
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7); 
        setCapturedImages(prev => [...prev, dataUrl]);
      }
    }
  };

  const removeImage = (indexToRemove: number) => {
    setCapturedImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    
    // VALIDATION: Photo is mandatory
    if (capturedImages.length === 0) {
      setErrorMsg("At least one photo evidence is required to submit wastage.");
      return;
    }

    const hasItems = skus.some(sku => {
       const qty = parseInt(inputs[sku.id] || '0');
       return qty > 0;
    });

    if (!hasItems) {
      setErrorMsg("Please enter wastage quantity for at least one item.");
      return;
    }

    // If valid, open confirmation
    setIsConfirmOpen(true);
  };

  const confirmSubmit = async () => {
    setIsSubmitting(true);
    
    // 1. Upload Images to BunnyCDN
    // We upload all attached images in parallel
    const uploadedUrls: string[] = [];
    
    try {
      const uploadPromises = capturedImages.map(base64 => uploadImageToBunny(base64, 'wastage'));
      const results = await Promise.all(uploadPromises);
      uploadedUrls.push(...results);
    } catch (e) {
      console.error("Error during image upload, using fallbacks", e);
      // If upload fails entirely, use original base64 to prevent data loss
      uploadedUrls.push(...capturedImages); 
    }

    // 2. Prepare Transactions
    const transactionsToSave: any[] = [];
    
    skus.forEach(sku => {
      const qty = parseInt(inputs[sku.id] || '0');
      if (qty > 0) {
        transactionsToSave.push({
          date,
          branchId,
          skuId: sku.id,
          type: TransactionType.WASTE,
          quantityPieces: qty,
          imageUrls: uploadedUrls, // Attach the CDN URLs (or Base64 fallbacks)
          userId: currentUser?.id,
          userName: currentUser?.name
        });
      }
    });

    // 3. Save to Store/DB
    if (transactionsToSave.length > 0) {
      await addBatchTransactions(transactionsToSave);
      setSuccessMsg(`Successfully recorded wastage for ${transactionsToSave.length} items.`);
      setInputs({});
      setCapturedImages([]);
      setIsConfirmOpen(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
    
    setIsSubmitting(false);
  };

  const getCategoryColor = (category: SKUCategory) => {
    switch (category) {
      case SKUCategory.STEAM: return 'bg-blue-100 text-blue-800 border-blue-200';
      case SKUCategory.KURKURE: return 'bg-amber-100 text-amber-800 border-amber-200';
      case SKUCategory.WHEAT: return 'bg-orange-100 text-orange-800 border-orange-200';
      case SKUCategory.ROLL: return 'bg-purple-100 text-purple-800 border-purple-200';
      case SKUCategory.CONSUMABLES: return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Helper to render SKU Item Card
  const renderSkuItem = (sku: SKU) => {
    const qty = parseInt(inputs[sku.id] || '0');
    const hasValue = qty > 0;
    const categoryColor = getCategoryColor(sku.category);

    return (
      <div key={sku.id} className={`rounded-xl border transition-all ${hasValue ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'} p-3 shadow-sm flex items-center justify-between gap-4`}>
         <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-1.5 py-0 rounded border font-bold uppercase tracking-wide leading-none ${categoryColor}`}>
                  {sku.category}
              </span>
               {sku.dietary !== SKUDietary.NA && (
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sku.dietary === 'Veg' ? 'bg-green-500' : 'bg-red-500'}`} />
              )}
             </div>
             <h3 className="font-bold text-slate-700 truncate">{sku.name}</h3>
         </div>

         <div className="w-24 md:w-32 flex-shrink-0">
            <div className="relative">
              <input 
                type="number" 
                min="0"
                placeholder="0"
                value={inputs[sku.id] || ''}
                onChange={(e) => handleInputChange(sku.id, e.target.value)}
                className={`w-full text-center border rounded-lg h-10 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 ${hasValue ? 'border-red-300 bg-white' : 'border-slate-200'}`}
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 pointer-events-none">pcs</span>
            </div>
         </div>
      </div>
    );
  };

  const getSourceLabel = () => {
    if (branchId === 'FRIDGE') return 'Main Fridge (Central)';
    const b = branches.find(br => br.id === branchId);
    return b ? b.name : 'Unknown';
  };

  // Filter and split SKUs
  const filteredSkus = skus.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const standardSkus = filteredSkus.filter(s => s.category !== SKUCategory.CONSUMABLES);
  const consumableSkus = filteredSkus.filter(s => s.category === SKUCategory.CONSUMABLES);

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-red-700 flex items-center gap-2">
          <Trash2 /> Wastage Report
        </h2>
        <p className="text-slate-500 text-sm md:text-base">Record damaged or expired inventory.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Branch Selector */}
        <div className="p-4 md:p-6 bg-slate-50 border-b border-slate-200">
           <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
             <Store size={14} /> Source of Wastage
           </label>
           
           <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {/* Central Fridge Option */}
              <button
                 type="button"
                 onClick={() => setBranchId('FRIDGE')}
                 className={`flex-shrink-0 px-5 py-2.5 rounded-full font-medium text-sm transition-all whitespace-nowrap border flex items-center gap-2 ${
                   branchId === 'FRIDGE'
                     ? 'bg-red-800 text-white border-red-800 shadow-md transform scale-105'
                     : 'bg-white text-slate-600 border-slate-200 hover:bg-white hover:border-slate-400'
                 }`}
               >
                 <Snowflake size={14} /> Main Fridge (Central)
               </button>

               {/* Branches */}
               {branches.map(branch => (
                 <button
                   key={branch.id}
                   type="button"
                   onClick={() => setBranchId(branch.id)}
                   className={`flex-shrink-0 px-5 py-2.5 rounded-full font-medium text-sm transition-all whitespace-nowrap border ${
                     branchId === branch.id
                       ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105'
                       : 'bg-white text-slate-600 border-slate-200 hover:bg-white hover:border-slate-400'
                   }`}
                 >
                   {branch.name}
                 </button>
               ))}
           </div>
           {branchId === 'FRIDGE' && (
              <div className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1 animate-fade-in">
                  <AlertTriangle size={12} />
                  Warning: Items reported here will be deducted directly from the Main Fridge Inventory.
              </div>
           )}
        </div>

        <form onSubmit={handlePreSubmit} className="p-4 md:p-6 space-y-6">
          {/* Date Selector */}
          <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <label className="block text-xs font-bold text-red-800 uppercase tracking-wide mb-1.5">Date of Wastage</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar size={16} className="text-red-400" />
                  </div>
                  <input 
                    type="date" 
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full border border-red-200 rounded-lg pl-10 pr-3 py-2.5 focus:ring-2 focus:ring-red-500 focus:outline-none bg-white text-slate-700"
                  />
                </div>
                <button 
                  type="button" 
                  onClick={setYesterday}
                  className="px-4 py-2.5 text-sm font-medium bg-white border border-red-200 rounded-lg text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                >
                  Yesterday
                </button>
              </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm md:text-base text-slate-700"
            />
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-2 text-xs font-semibold text-slate-400 uppercase">
            <div className="col-span-8 md:col-span-9">Product</div>
            <div className="col-span-4 md:col-span-3 text-center">Wastage (Pcs)</div>
          </div>

          {/* Standard Items List */}
          <div className="space-y-3">
            {standardSkus.length > 0 ? (
               standardSkus.map(renderSkuItem)
            ) : (
               <div className="text-center text-slate-400 py-4 text-sm italic">
                  {searchQuery ? "No matching standard items found" : "No standard items available"}
               </div>
            )}
          </div>

          {/* Consumables Expandable Section */}
          <div className="border-t border-slate-200 pt-2 mt-4">
             <button
               type="button"
               onClick={() => setIsConsumablesOpen(!isConsumablesOpen)}
               className="flex items-center justify-between w-full py-3 px-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
             >
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-sm uppercase tracking-wide">Consumables / Others</span>
                  <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full font-bold">
                    {consumableSkus.length}
                  </span>
                </div>
                {isConsumablesOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
             </button>

             {isConsumablesOpen && (
               <div className="space-y-3 mt-3 animate-fade-in pl-2 border-l-2 border-slate-200">
                  {consumableSkus.length > 0 ? (
                    consumableSkus.map(renderSkuItem)
                  ) : (
                    <div className="text-center text-slate-400 py-4 text-sm italic">
                       {searchQuery ? "No matching consumables found" : "No consumables available"}
                    </div>
                  )}
               </div>
             )}
          </div>

          {/* Photo Evidence Section */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2">
                <Camera size={16} className={capturedImages.length === 0 ? "text-red-500" : "text-emerald-500"} /> 
                Photo Evidence <span className="text-red-500">*</span>
              </h3>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{capturedImages.length} attached</span>
            </div>
            
            {/* Hidden Canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />

            {!isCameraOpen && (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {/* Add Button */}
                 <button 
                  type="button"
                  onClick={startCamera}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-slate-100 transition-colors"
                 >
                   <Camera size={24} className="mb-2" />
                   <span className="text-xs font-semibold">Take Photo</span>
                 </button>

                 {/* Thumbnails */}
                 {capturedImages.map((img, index) => (
                   <div key={index} className="aspect-square rounded-xl border border-slate-200 bg-slate-100 relative group overflow-hidden shadow-sm">
                      <img src={img} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-90 hover:opacity-100 hover:scale-110 transition-all shadow-md"
                        title="Remove"
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 rounded">
                        #{index + 1}
                      </div>
                   </div>
                 ))}
               </div>
            )}

            {isCameraOpen && (
              <div className="relative bg-black rounded-xl overflow-hidden shadow-lg aspect-[3/4] md:aspect-video flex flex-col">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover flex-1"
                />
                
                {/* Camera Controls Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                   <button 
                    type="button"
                    onClick={stopCamera}
                    className="text-white px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 text-sm font-medium"
                   >
                     Done
                   </button>

                   <button 
                    type="button"
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-transparent hover:bg-white/20 transition-colors active:scale-95"
                   >
                     <div className="w-12 h-12 bg-white rounded-full"></div>
                   </button>

                   <div className="bg-white/10 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-mono">
                     {capturedImages.length} Pics
                   </div>
                </div>

                {/* Last captured preview toast */}
                {capturedImages.length > 0 && (
                   <div className="absolute top-4 right-4 w-16 h-16 rounded-lg border-2 border-white overflow-hidden shadow-lg bg-black animate-fade-in">
                      <img src={capturedImages[capturedImages.length - 1]} className="w-full h-full object-cover opacity-80" />
                   </div>
                )}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 z-50">
              <div className="bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg text-center font-medium animate-fade-in-up flex items-center justify-center gap-2">
                <AlertTriangle size={18} />
                {errorMsg}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 z-50">
              <div className="bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg text-center font-medium animate-fade-in-up">
                {successMsg}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 sticky bottom-0 bg-white md:static p-4 md:p-0 -mx-4 md:mx-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none z-40">
            <button 
              type="submit"
              disabled={branches.length === 0 && branchId !== 'FRIDGE'}
              className="w-full md:w-auto ml-auto px-8 py-3.5 md:py-3 rounded-xl text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
            >
              <Trash2 size={20} />
              Review & Submit
            </button>
          </div>
        </form>
      </div>

       {/* Confirmation Modal */}
       {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <div className="p-5 border-b border-red-100 flex justify-between items-center rounded-t-xl bg-red-50">
                 <div>
                    <h3 className="text-lg font-bold text-red-800">
                      Confirm Wastage Report
                    </h3>
                    <p className="text-sm text-slate-500">
                      Source: <span className="font-bold">{getSourceLabel()}</span>
                    </p>
                 </div>
                 <button onClick={() => setIsConfirmOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={24} />
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                 <div className="flex items-center gap-2 mb-4 text-sm text-slate-500 bg-slate-50 p-2 rounded-lg">
                    <Calendar size={14} /> Date: <span className="font-bold text-slate-700">{date}</span>
                 </div>

                 <div className="space-y-2">
                    {skus.map(sku => {
                       const qty = parseInt(inputs[sku.id] || '0');
                       if (qty === 0) return null;
                       
                       return (
                          <div 
                            key={sku.id} 
                            className="flex justify-between items-center p-3 rounded-lg border bg-white border-slate-200"
                          >
                             <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full flex-shrink-0 bg-red-500" />
                                <span className="font-medium text-slate-700">{sku.name}</span>
                             </div>
                             
                             <div className="text-right">
                                <div className="font-mono font-bold text-red-700 leading-none">
                                   -{qty} <span className="text-xs font-sans font-normal opacity-60">pcs</span>
                                </div>
                             </div>
                          </div>
                       )
                    })}
                 </div>

                 <div className="mt-4 p-3 bg-red-50 rounded-lg text-xs text-red-800 flex items-start gap-2 border border-red-100">
                    <Camera size={14} className="mt-0.5 flex-shrink-0"/>
                    <p>Evidence: <strong>{capturedImages.length} photos</strong> attached. They will be uploaded to Pakaja Cloud (BunnyCDN).</p>
                 </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                 <button 
                   onClick={() => setIsConfirmOpen(false)}
                   disabled={isSubmitting}
                   className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-white transition-colors disabled:opacity-50"
                 >
                   Edit
                 </button>
                 <button 
                   onClick={confirmSubmit}
                   disabled={isSubmitting}
                   className="px-6 py-2.5 rounded-lg text-white font-bold transition-colors shadow-sm flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-70 disabled:cursor-not-allowed"
                 >
                   {isSubmitting ? (
                     <>
                        <Loader2 size={18} className="animate-spin" />
                        Uploading...
                     </>
                   ) : (
                     <>
                        <CheckCircle2 size={18} />
                        Confirm Wastage
                     </>
                   )}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Wastage;

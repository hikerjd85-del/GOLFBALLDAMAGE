import React, { useState, useEffect, useRef } from "react";
import { 
  Camera, 
  Calendar, 
  User, 
  Check, 
  AlertTriangle, 
  Trash2, 
  CheckCircle2, 
  RefreshCw, 
  FileText, 
  X,
  ShieldAlert,
  ArrowRight,
  BookOpen,
  ChevronDown,
  History,
  Info,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { collection, doc, setDoc, onSnapshot, query, orderBy, getDocFromServer } from "firebase/firestore";

// Types for our incident report
interface IncidentReport {
  id: string;
  name: string;
  dateTime: string;
  photoUrl: string | null;
  incidentType: "injury" | "property" | "near_miss" | "other" | null;
  customDescription?: string;
  timestamp: string;
}

export default function App() {
  // State variables for form fields
  const [name, setName] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [dateTime, setDateTime] = useState<string>("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [incidentType, setIncidentType] = useState<"injury" | "property" | "near_miss" | "other" | null>(null);
  const [otherDescription, setOtherDescription] = useState<string>("");
  
  // Submission history & helper view flows
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedReport, setSubmittedReport] = useState<IncidentReport | null>(null);
  const [pastReports, setPastReports] = useState<IncidentReport[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; incidentType?: string }>({});
  const [showPhotoWarning, setShowPhotoWarning] = useState<boolean>(false);
  
  // Interactive website info tabs
  const [activeTab, setActiveTab] = useState<"report" | "history" | "guide">("report");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Hidden file input reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backend synchronization indicators
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Load state and past history from local storage and firestore in real-time
  useEffect(() => {
    const savedName = localStorage.getItem("golf_incident_user_name");
    const savedRemember = localStorage.getItem("golf_incident_remember");
    const savedReports = localStorage.getItem("golf_incident_history");
    
    if (savedRemember !== null) {
      setRememberMe(savedRemember === "true");
    }
    if (savedName && (savedRemember === "true" || savedRemember === null)) {
      setName(savedName);
    }
    
    // Load local storage reports initially as an optimistic visual cache
    if (savedReports) {
      try {
        setPastReports(JSON.parse(savedReports));
      } catch (e) {
        console.error("Failed to parse localized report history", e);
      }
    }

    // Set auto-filled current local time in "YYYY-MM-DDTHH:MM" format
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    setDateTime(localISOTime);

    // Validate connectivity to Firestore on mount as per skill guidelines
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, "incidents", "connection-test"));
        setIsOffline(false);
      } catch (error) {
        if (error instanceof Error && (error.message.includes("offline") || error.message.includes("failed-precondition"))) {
          console.warn("Firestore client is offline, entering local caching mode.");
          setIsOffline(true);
        }
      }
    };
    testConnection();

    // Subscribe to Firestore collection with ordering on timestamp/dateTime
    const incidentsRef = collection(db, "incidents");
    const q = query(incidentsRef, orderBy("dateTime", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports: IncidentReport[] = [];
      snapshot.forEach((docSnap) => {
        reports.push(docSnap.data() as IncidentReport);
      });
      setPastReports(reports);
      localStorage.setItem("golf_incident_history", JSON.stringify(reports));
      setIsSyncing(false);
      setIsOffline(false);
    }, (error) => {
      console.error("Firestore sync error:", error);
      setIsSyncing(false);
      try {
        handleFirestoreError(error, OperationType.LIST, "incidents");
      } catch (e) {
        // Soft logged error
      }
    });

    return () => unsubscribe();
  }, []);

  // Update date-time manually helper
  const handleResetToNow = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    setDateTime(localISOTime);
  };

  // Profile Remember Me handle
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (rememberMe) {
      localStorage.setItem("golf_incident_user_name", value);
    }
  };

  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setRememberMe(checked);
    localStorage.setItem("golf_incident_remember", String(checked));
    if (checked) {
      localStorage.setItem("golf_incident_user_name", name);
    } else {
      localStorage.removeItem("golf_incident_user_name");
    }
  };

  // Handle Photo input / camera trigger
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
        setShowPhotoWarning(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Clear submission log helper
  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your local submission history? This will delete the list from this device's memory.")) {
      localStorage.removeItem("golf_incident_history");
      setPastReports([]);
    }
  };

  // Form Submission handling
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const errors: { name?: string; incidentType?: string } = {};
    if (!name.trim()) {
      errors.name = "Please enter your Name and Unit Number.";
    }
    if (!incidentType) {
      errors.incidentType = "Please select an Incident Type.";
    } else if (incidentType === "other" && !otherDescription.trim()) {
      errors.incidentType = "Please write a brief description of the incident.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Scroll to the first error
      const firstErrorEl = document.getElementById(errors.name ? "name-field" : "incident-field");
      if (firstErrorEl) {
        firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setFieldErrors({});

    // If photo is missing, show warning to give elderly residents a strong reminder
    if (!photo && !showPhotoWarning) {
      setShowPhotoWarning(true);
      const photoEl = document.getElementById("photo-field");
      if (photoEl) {
        photoEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // Process submission
    const reportId = `GIR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newReport: IncidentReport = {
      id: reportId,
      name: name.trim(),
      dateTime: dateTime,
      photoUrl: photo,
      incidentType: incidentType,
      customDescription: incidentType === "other" ? otherDescription.trim() : undefined,
      timestamp: new Date().toLocaleString()
    };

    // Save report to firestore backend database + offline fallback local cache
    const saveReportObj = async (report: IncidentReport) => {
      try {
        await setDoc(doc(db, "incidents", report.id), report);
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, `incidents/${report.id}`);
        } catch (e) {
          console.error("Firestore persistence error:", e);
        }
      }
    };
    saveReportObj(newReport);

    // Save report to device storage history
    const updatedHistory = [newReport, ...pastReports];
    setPastReports(updatedHistory);
    localStorage.setItem("golf_incident_history", JSON.stringify(updatedHistory));

    // Save user info again if remember me is active
    if (rememberMe) {
      localStorage.setItem("golf_incident_user_name", name.trim());
    }

    // Set submitted report state to transition view
    setSubmittedReport(newReport);
    setIsSubmitted(true);
    setShowPhotoWarning(false);
  };

  // Reset core states for new report
  const handleResetForm = () => {
    if (!rememberMe) {
      setName("");
    }
    setPhoto(null);
    setIncidentType(null);
    setOtherDescription("");
    setIsSubmitted(false);
    setSubmittedReport(null);
    setFieldErrors({});
    setShowPhotoWarning(false);
    
    // Auto-update date of new incident to current time
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    setDateTime(localISOTime);
    
    // Switch back to report view
    setActiveTab("report");
  };

  const faqItems = [
    {
      q: "What is my legal responsibility when reporting?",
      a: "As a resident, documenting incidents promptly secures critical evidence for liability. This application generates an official timestamped record of damage or near-miss safety hazards."
    },
    {
      q: "Who pays for broken windows or bodily injury?",
      a: "In most golf course communities, the golfer who struck the ball is legally responsible. If they cannot be identified, HOA guidelines or local litigation determines whether the golf club or personal homeowner insurance covers repairs."
    },
    {
      q: "How does the HOA track repeat offenders?",
      a: "Each report is indexed securely to build statistical proof of safety issues, helping negotiate safety nets, trees, or modifications to the course layout."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col items-center justify-start md:py-8 px-0 sm:px-4">
      
      {/* High-quality Responsive Page Header for Desktop view, cleanly hidden for immersive mobile */}
      <div className="hidden md:block text-center mb-6 max-w-md w-full">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">HOA Safety & Compliance Portal</p>
        <span className="text-xs text-slate-400">Optimized for smartphones & tablets</span>
      </div>

      {/* Main Core Viewport Wrapper - Fluid width, optimized perfectly to open on phones */}
      <div className="w-full max-w-md bg-white shadow-2xl min-h-screen md:min-h-[85vh] md:rounded-3xl overflow-hidden flex flex-col border border-slate-200/50">
        
        {/* APP HEADER */}
        <header className="bg-slate-900 text-white px-5 py-6 text-center select-none shadow-md">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="inline-flex justify-center items-center w-8 h-8 rounded-full bg-red-500 text-white animate-pulse">
              <ShieldAlert className="w-5 h-5 text-white" />
            </span>
            <h1 className="text-xl font-extrabold tracking-tight">
              Golf Ball Incident Report
            </h1>
          </div>
          <p className="text-slate-400 text-xs font-extrabold uppercase tracking-wider">
            Resident Liability & Documentation
          </p>
        </header>

        {/* WEBSITES OPTIMIZED NAVIGATION TABS */}
        <div className="flex bg-slate-100 border-b border-slate-200 text-sm font-bold p-1 gap-1">
          <button
            onClick={() => { setActiveTab("report"); if (isSubmitted) handleResetForm(); }}
            className={`flex-1 py-3 text-center rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "report" 
                ? "bg-white text-indigo-700 shadow-xs" 
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Camera className="w-4 h-4" />
            File Report
          </button>
          
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3 text-center rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 relative ${
              activeTab === "history" 
                ? "bg-white text-indigo-700 shadow-xs" 
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <History className="w-4 h-4" />
            My Log
            {pastReports.length > 0 && (
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("guide")}
            className={`flex-1 py-3 text-center rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "guide" 
                ? "bg-white text-indigo-700 shadow-xs" 
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            FAQ & Advice
          </button>
        </div>

        {/* Backend Cloud Sync Badge */}
        <div className="bg-slate-50 px-5 py-2 border-b border-slate-200/50 flex justify-between items-center text-[11px] font-bold text-slate-500 select-none">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isOffline ? "bg-amber-500" : isSyncing ? "bg-indigo-500 animate-pulse" : "bg-emerald-500"}`} />
            <span>
              {isOffline ? "Offline Caching Mode" : isSyncing ? "Syncing database..." : "Connected to Compliance Cloud"}
            </span>
          </div>
          <span className="text-[10px] text-indigo-600/80 uppercase tracking-widest font-extrabold font-mono">HOA Vault Active</span>
        </div>

        {/* MAIN BODY SCROLL AREA */}
        <main className="flex-1 p-5 md:p-6 flex flex-col justify-between bg-white relative">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: FORM REPORTING */}
            {activeTab === "report" && !isSubmitted && (
              <motion.form 
                key="reporting-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit}
                className="space-y-6 flex-1 flex flex-col justify-between"
                noValidate
              >
                <div className="space-y-6">
                  
                  {/* FIELD 1: USER INFO */}
                  <div id="name-field" className="space-y-2">
                    <label 
                      htmlFor="user-info-input" 
                      className="block text-sm font-black text-slate-700 uppercase tracking-wide"
                    >
                      1. Name / Unit Number
                      <span className="text-red-500 ml-1 font-semibold">*</span>
                    </label>
                    
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User className="h-5 w-5" />
                      </div>
                      <input
                        id="user-info-input"
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                        placeholder="e.g. Mabel Smith - Unit 204"
                        className={`w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 rounded-xl text-base md:text-lg focus:outline-hidden focus:bg-white focus:border-indigo-600 transition-colors text-slate-950 font-bold ${
                          fieldErrors.name ? "border-red-500 bg-red-50/50" : "border-slate-300"
                        }`}
                        aria-invalid={fieldErrors.name ? "true" : "false"}
                        aria-describedby={fieldErrors.name ? "name-error" : undefined}
                      />
                    </div>
                    
                    {fieldErrors.name && (
                      <p id="name-error" className="text-red-600 text-sm font-bold flex items-center gap-1 mt-1">
                        ⚠️ {fieldErrors.name}
                      </p>
                    )}

                    {/* LARGE REMEMBER ME CHECKBOX */}
                    <label className="flex items-center gap-3 py-1 cursor-pointer select-none active:scale-95 transition-transform">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={handleRememberMeChange}
                          className="sr-only"
                          id="remember-checkbox"
                        />
                        <div className={`w-7 h-7 border-2 rounded-lg flex items-center justify-center transition-colors ${
                          rememberMe ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300"
                        }`}>
                          {rememberMe && <Check className="w-5 h-5 text-white stroke-[3.5px]" />}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-600">
                        Remember me on this phone
                      </span>
                    </label>
                  </div>

                  {/* FIELD 2: DATE & TIME */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label 
                        htmlFor="datetime-input" 
                        className="block text-sm font-black text-slate-700 uppercase tracking-wide"
                      >
                        2. Date & Time of Incident
                      </label>
                      <button
                        type="button"
                        onClick={handleResetToNow}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1 px-2.5 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-slate-50 shadow-2xs"
                      >
                        <RefreshCw className="w-3 h-3" /> Use Current Time
                      </button>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Calendar className="h-5 w-5" />
                      </div>
                      <input
                        id="datetime-input"
                        type="datetime-local"
                        value={dateTime}
                        onChange={(e) => setDateTime(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-base md:text-lg focus:outline-hidden focus:bg-white focus:border-indigo-600 transition-colors text-slate-950 font-bold"
                      />
                    </div>
                  </div>

                  {/* FIELD 3: EVIDENCE (PHOTO UPLOAD) */}
                  <div id="photo-field" className="space-y-2">
                    <label className="block text-sm font-black text-slate-700 uppercase tracking-wide">
                      3. Take Photo / Upload Image
                    </label>
                    
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      id="evidence-file-input"
                    />

                    {!photo ? (
                      <button
                        type="button"
                        onClick={triggerCamera}
                        className={`w-full border-3 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors duration-150 cursor-pointer text-slate-600 bg-slate-50 hover:bg-indigo-50/40 hover:border-indigo-400 ${
                          showPhotoWarning ? "border-red-400 bg-red-50/30" : "border-slate-300"
                        }`}
                      >
                        <div className="p-4 bg-white rounded-full shadow-md text-indigo-600 border border-slate-100 active:scale-95 transition-transform">
                          <Camera className="w-8 h-8 stroke-[2.2]" />
                        </div>
                        <div className="text-center">
                          <span className="block font-extrabold text-base md:text-lg text-indigo-900">
                            Tap to Open Camera
                          </span>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            Submit key proof for HOA/Legal claims
                          </span>
                        </div>
                      </button>
                    ) : (
                      <div className="relative border-2 border-slate-300 rounded-xl p-2 bg-slate-100">
                        <img 
                          src={photo} 
                          alt="Incident Preview" 
                          referrerPolicy="no-referrer"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-bold shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    )}

                    {showPhotoWarning && (
                      <div className="bg-red-50 border-2 border-red-200 text-red-950 p-4 rounded-xl text-xs space-y-2">
                        <p className="font-extrabold flex items-center gap-1.5 text-red-800 text-sm">
                          ⚠️ No Picture Attached
                        </p>
                        <p className="font-semibold text-slate-700">
                          Photos are extremely helpful for securing compensation. Would you like to take one now?
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={triggerCamera}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-4 rounded-lg text-xs"
                          >
                            📷 Snap Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPhotoWarning(false);
                              setTimeout(() => {
                                const reportId = `GIR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
                                const newReport: IncidentReport = {
                                  id: reportId,
                                  name: name.trim(),
                                  dateTime: dateTime,
                                  photoUrl: null,
                                  incidentType: incidentType,
                                  customDescription: incidentType === "other" ? otherDescription.trim() : undefined,
                                  timestamp: new Date().toLocaleString()
                                };
                                
                                // Save to firestore as well
                                const saveReportDirect = async (report: IncidentReport) => {
                                  try {
                                    await setDoc(doc(db, "incidents", report.id), report);
                                  } catch (err) {
                                    try {
                                      handleFirestoreError(err, OperationType.CREATE, `incidents/${report.id}`);
                                    } catch (e) {
                                      console.error("Firestore persistence error:", e);
                                    }
                                  }
                                };
                                saveReportDirect(newReport);

                                const updatedHistory = [newReport, ...pastReports];
                                setPastReports(updatedHistory);
                                localStorage.setItem("golf_incident_history", JSON.stringify(updatedHistory));
                                setSubmittedReport(newReport);
                                setIsSubmitted(true);
                              }, 100);
                            }}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-3 rounded-lg text-xs"
                          >
                            Submit Without Photo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FIELD 4: INCIDENT TYPE */}
                  <div id="incident-field" className="space-y-2">
                    <label className="block text-sm font-black text-slate-700 uppercase tracking-wide">
                      4. Incident Type
                      <span className="text-red-500 ml-1 font-semibold">*</span>
                    </label>

                    {/* High-tactility tactile color buttons */}
                    <div className="grid grid-cols-1 gap-3">
                      
                      {/* RED: Personal Injury */}
                      <button
                        type="button"
                        onClick={() => {
                          setIncidentType("injury");
                          if (fieldErrors.incidentType) {
                            setFieldErrors(prev => ({ ...prev, incidentType: undefined }));
                          }
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-3 text-left transition-all relative ${
                          incidentType === "injury"
                            ? "bg-red-50/90 border-red-600 ring-4 ring-red-200/80 scale-[1.01]"
                            : "bg-white border-slate-200 hover:border-slate-300 active:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="text-3xl shrink-0">🔴</span>
                          <div>
                            <span className="block font-black text-lg text-red-950 leading-tight">
                              Personal Injury
                            </span>
                            <span className="text-xs text-red-800 font-bold block mt-0.5">
                              Struck by ball, fallback safety hazard
                            </span>
                          </div>
                        </div>
                        {incidentType === "injury" && (
                          <div className="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center text-white shrink-0">
                            <Check className="w-4 h-4 stroke-[3.5]" />
                          </div>
                        )}
                      </button>

                      {/* YELLOW: Property Damage */}
                      <button
                        type="button"
                        onClick={() => {
                          setIncidentType("property");
                          if (fieldErrors.incidentType) {
                            setFieldErrors(prev => ({ ...prev, incidentType: undefined }));
                          }
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-3 text-left transition-all relative ${
                          incidentType === "property"
                            ? "bg-amber-50 border-amber-500 ring-4 ring-amber-100 scale-[1.01]"
                            : "bg-white border-slate-200 hover:border-slate-300 active:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="text-3xl shrink-0">🟡</span>
                          <div>
                            <span className="block font-black text-lg text-amber-950 leading-tight">
                              Property Damage
                            </span>
                            <span className="text-xs text-amber-800 font-bold block mt-0.5">
                              Broken windows, roof tiles, lawn, or patio
                            </span>
                          </div>
                        </div>
                        {incidentType === "property" && (
                          <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center text-white shrink-0">
                            <Check className="w-4 h-4 stroke-[3.5]" />
                          </div>
                        )}
                      </button>

                      {/* GREEN: Near Miss */}
                      <button
                        type="button"
                        onClick={() => {
                          setIncidentType("near_miss");
                          if (fieldErrors.incidentType) {
                            setFieldErrors(prev => ({ ...prev, incidentType: undefined }));
                          }
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-3 text-left transition-all relative ${
                          incidentType === "near_miss"
                            ? "bg-emerald-50 border-emerald-600 ring-4 ring-emerald-100 scale-[1.01]"
                            : "bg-white border-slate-200 hover:border-slate-300 active:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="text-3xl shrink-0">🟢</span>
                          <div>
                            <span className="block font-black text-lg text-emerald-950 leading-tight">
                              Near Miss / No Damage
                            </span>
                            <span className="text-xs text-emerald-800 font-bold block mt-0.5">
                              Landed on decking, driveway or pool very close
                            </span>
                          </div>
                        </div>
                        {incidentType === "near_miss" && (
                          <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center text-white shrink-0">
                            <Check className="w-4 h-4 stroke-[3.5]" />
                          </div>
                        )}
                      </button>

                      {/* SLATE: Other / Custom */}
                      <button
                        type="button"
                        onClick={() => {
                          setIncidentType("other");
                          if (fieldErrors.incidentType) {
                            setFieldErrors(prev => ({ ...prev, incidentType: undefined }));
                          }
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-3 text-left transition-all relative ${
                          incidentType === "other"
                            ? "bg-slate-50 border-slate-600 ring-4 ring-slate-100 scale-[1.01]"
                            : "bg-white border-slate-200 hover:border-slate-300 active:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="text-3xl shrink-0">⚪</span>
                          <div>
                            <span className="block font-black text-lg text-slate-950 leading-tight">
                              Other Incident
                            </span>
                            <span className="text-xs text-slate-600 font-bold block mt-0.5">
                              Choose here to write custom description of damage or hazard
                            </span>
                          </div>
                        </div>
                        {incidentType === "other" && (
                          <div className="w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center text-white shrink-0">
                            <Check className="w-4 h-4 stroke-[3.5]" />
                          </div>
                        )}
                      </button>

                    </div>

                    {/* ANIMATED OPTIONAL CUSTOM DESCRIPTION TEXTAREA */}
                    <AnimatePresence>
                      {incidentType === "other" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden space-y-2 pt-2"
                        >
                          <label 
                            htmlFor="custom-desc-input"
                            className="block text-xs font-black text-slate-700 uppercase tracking-wide"
                          >
                            Describe the custom incident in detail:
                          </label>
                          <textarea
                            id="custom-desc-input"
                            rows={3}
                            value={otherDescription}
                            onChange={(e) => setOtherDescription(e.target.value)}
                            placeholder="e.g. A golf ball shattered my solar lights outside or damaged pool equipment in the backyard."
                            className="w-full p-3.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-base focus:outline-hidden focus:bg-white focus:border-indigo-600 transition-colors text-slate-950 font-bold"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {fieldErrors.incidentType && (
                      <p className="text-red-600 text-sm font-bold flex items-center gap-1 mt-1">
                        ⚠️ {fieldErrors.incidentType}
                      </p>
                    
                    )}
                  </div>

                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-6 mt-6 border-t border-slate-100">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-slate-900 text-white font-extrabold text-lg py-5 px-6 rounded-2xl hover:shadow-lg transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer shadow-md select-none leading-none animate-none"
                    id="submit-report-btn"
                  >
                    <span>Submit</span>
                  </button>
                </div>
              </motion.form>
            )}

            {/* CONFIRMATION SCREEN */}
            {activeTab === "report" && isSubmitted && (
              <motion.div 
                key="submission-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-4 space-y-6 flex-1 flex flex-col justify-between"
              >
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto">
                    <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    Record Submitted!
                  </h2>
                  <p className="text-slate-600 text-sm font-bold max-w-xs mx-auto">
                    The incident has been timestamped and backed up securely in your device list.
                  </p>
                </div>

                {/* SCOPE TIGHT DIGEST */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                    <span className="text-xs font-bold text-slate-500 tracking-wider">TRACKING ID</span>
                    <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono">
                      {submittedReport?.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-sm">
                    <div>
                      <span className="block text-slate-500 text-xs font-bold">REPORTER</span>
                      <span className="font-extrabold text-slate-800 break-all">{submittedReport?.name}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-xs font-bold">DAMAGE TYPE</span>
                      <span className="font-extrabold text-slate-800 flex flex-col items-start gap-1 mt-0.5">
                        {submittedReport?.incidentType === "injury" && "🔴 Injury"}
                        {submittedReport?.incidentType === "property" && "🟡 Damage"}
                        {submittedReport?.incidentType === "near_miss" && "🟢 Near Miss"}
                        {submittedReport?.incidentType === "other" && "⚪ Other"}
                        {submittedReport?.incidentType === "other" && submittedReport?.customDescription && (
                          <span className="text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700 italic block font-semibold text-left max-w-full break-words">
                            "{submittedReport.customDescription}"
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-slate-500 text-xs font-bold">TIMESTAMP RECORDED</span>
                      <span className="font-extrabold text-slate-800">
                        {submittedReport?.dateTime 
                          ? new Date(submittedReport.dateTime).toLocaleString("en-US", {
                              dateStyle: "medium",
                              timeStyle: "short"
                            })
                          : "N/A"
                        }
                      </span>
                    </div>
                  </div>

                  {submittedReport?.photoUrl && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="block text-slate-500 text-xs font-bold mb-1.5">SUBMITTED PHOTO</span>
                      <img 
                        src={submittedReport.photoUrl} 
                        alt="Submitted proof image" 
                        referrerPolicy="no-referrer"
                        className="w-full h-32 object-cover rounded-lg border border-slate-200"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-4">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-extrabold text-lg py-5 px-6 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>File Another Incident</span>
                  </button>
                  <p className="text-center text-slate-500 text-xs mt-3 font-semibold leading-relaxed">
                    Need to look at previous files? Tap <strong className="text-indigo-600">My Log</strong> tab above.
                  </p>
                </div>
              </motion.div>
            )}

            {/* TAB 2: DEVICE LOG (HISTORY DETAILED VIEW) */}
            {activeTab === "history" && (
              <motion.div
                key="history-tab"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5 flex-1 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" /> My Reported Logs
                    </h3>
                    {pastReports.length > 0 && (
                      <button
                        onClick={handleClearHistory}
                        className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-slate-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Clear All
                      </button>
                    )}
                  </div>

                  {pastReports.length === 0 ? (
                    <div className="text-center py-12 px-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 my-4">
                      <p className="text-4xl mb-2">📥</p>
                      <h4 className="font-bold text-slate-800 text-base">No Incidents Filed Yet</h4>
                      <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                        Reports submitted on this smartphone will be archived here for easy reference in case of safety claims.
                      </p>
                      <button
                        onClick={() => setActiveTab("report")}
                        className="mt-5 bg-indigo-600 text-white font-bold text-xs py-2 px-4 rounded-lg inline-flex items-center gap-1.5 hover:bg-slate-900 transition-colors"
                      >
                        Write a New Report
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                      {pastReports.map((report) => (
                        <div 
                          key={report.id}
                          className="bg-white border-2 border-slate-200 rounded-xl p-4 space-y-3 shadow-xs hover:border-indigo-400 transition-colors"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="text-xs font-black px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-mono border border-slate-200">
                                {report.id}
                              </span>
                              <p className="font-bold text-sm text-slate-800 mt-1 break-all">By: {report.name}</p>
                            </div>
                            <span className="text-xs font-bold uppercase shrink-0">
                              {report.incidentType === "injury" && "🔴 Injury"}
                              {report.incidentType === "property" && "🟡 Damage"}
                              {report.incidentType === "near_miss" && "🟢 Near Miss"}
                              {report.incidentType === "other" && "⚪ Other"}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 space-y-1.5">
                            <p className="font-semibold">
                              📅 Incident: {new Date(report.dateTime).toLocaleString()}
                            </p>
                            {report.incidentType === "other" && report.customDescription && (
                              <p className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-xs italic font-bold text-slate-750 text-left break-words">
                                "{report.customDescription}"
                              </p>
                            )}
                            <p>
                              📝 Registered: {report.timestamp}
                            </p>
                          </div>

                          {report.photoUrl && (
                            <img 
                              src={report.photoUrl} 
                              alt="Logged Evidence" 
                              referrerPolicy="no-referrer"
                              className="w-full h-24 object-cover rounded-lg border border-slate-200"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* REDO SCREENSHOT SECTION */}
                <div className="bg-indigo-50/50 border border-indigo-200 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2 text-indigo-950">
                    <Camera className="w-4 h-4 text-indigo-600 shrink-0" />
                    <h4 className="text-xs font-black uppercase tracking-wider">
                      How to Save & Share Screenshots
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    This safety log is saved offline on your device. To share official records or pictures with insurance claims, the HOA, or city compliance boards, take a screenshot of your screen:
                  </p>
                  <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-bold text-slate-600 space-y-1.5 shadow-2xs">
                    <p className="flex justify-between">
                      <span>📱 Apple iPhone:</span>
                      <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] font-extrabold uppercase font-mono">Power + Vol Up</span>
                    </p>
                    <p className="flex justify-between">
                      <span>🤖 Android Device:</span>
                      <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] font-extrabold uppercase font-mono">Power + Vol Down</span>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: SAFETY GUIDE & FAQ */}
            {activeTab === "guide" && (
              <motion.div
                key="guide-tab"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5 flex-1 flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
                    📚 Resident Legal & Safety Advice
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4">
                    Quick answers compiled from homeowners associations and local safety regulations regarding golf course boundary hazards.
                  </p>

                  <div className="space-y-2">
                    {faqItems.map((faq, idx) => (
                      <div 
                        key={idx} 
                        className="border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-50"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                          className="w-full p-4 text-left font-bold text-slate-800 text-sm md:text-base flex justify-between items-center gap-2 hover:bg-slate-100 transition-colors"
                        >
                          <span>{faq.q}</span>
                          <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                            expandedFaq === idx ? "rotate-180" : ""
                          }`} />
                        </button>
                        
                        <AnimatePresence>
                          {expandedFaq === idx && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: "auto" }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <p className="p-4 pt-0 text-xs text-slate-600 border-t border-slate-200 leading-relaxed font-medium">
                                {faq.a}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-amber-100/70 border border-amber-200 p-4 rounded-xl text-xs space-y-1">
                    <p className="font-extrabold text-amber-900 flex items-center gap-1">
                      🚑 Immediate Danger?
                    </p>
                    <p className="text-slate-700 font-bold">
                      If anyone is actively injured or bleeding from a ball strike, call emergency services immediately before filing a report:
                    </p>
                    <p className="font-black text-red-600 text-sm pt-1">
                      Call 911 (Emergency)
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab("report")}
                      className="w-full bg-indigo-600 hover:bg-slate-900 text-white font-extrabold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>Return to Incident Report Form</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* FOOTER LINKS */}
      <div className="mt-4 mb-6 text-center space-y-1 text-xs text-slate-400 hidden md:block">
        <p>© 2026 ResiShield Inc. All Rights Reserved.</p>
        <p className="flex items-center justify-center gap-1">
          <span>Endorsed by state property codes</span>
          <span>•</span>
          <a href="#" className="hover:underline text-indigo-500">HOA Guidelines</a>
        </p>
      </div>
    </div>
  );
}


"use client";

import React, { useState } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

import "./styles.css";
import { useRouter } from "next/navigation";

const WORKSHOP_AMOUNT = 599; // ₹599

type PaymentState =
  | "idle"
  | "submitting"
  | "success"
  | "failed";

const faqs = [
  {
    q: "What will I learn in these workshops?",
    a: "In the Solidworks workshop (Hi-Tech 513), you'll learn to design CAD models and simulate them. In the Altium workshop, you'll learn PCB designing and simulations. Both feature hands-on approaches with industry certified mentors.",
  },
  {
    q: "When and where are the workshops?",
    a: "We are holding our flagship SolidWorks and Altium workshops on 11th, 12th and 13th of March, from 9 a.m. to 3 p.m. each day. The Solidworks workshop is happening at Hi-Tech 513.",
  },
  {
    q: "What should I bring?",
    a: "Please bring your own laptop for the Altium workshop. It is also recommended for the Solidworks workshop.",
  },
  {
    q: "Will I get a certificate and OD?",
    a: "Yes! Full day certificates, ODs, and refreshments shall be provided for the 3 days of the workshop.",
  },
  {
    q: "Can I get a refund if I can't attend?",
    a: "No, there is no refund available for these workshops.",
  },
];

export default function App() {

  const router = useRouter();
  const [hostel, setHostel] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [paymentError, setPaymentError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);



  function getFormData(): Record<string, string> | null {
    const formEle = document.querySelector("form");
    if (!formEle) return null;
    const fd = new FormData(formEle);
    const data: Record<string, string> = {};
    fd.forEach((value, key) => {
      data[key] = value as string;
    });
    return data;
  }

  function validateForm(data: Record<string, string>): string | null {
    if (!data.Name?.trim()) return "Please enter your name";
    if (!data.FullRegistrationNumber?.trim())
      return "Please enter your registration number";
    if (!data.Department?.trim()) return "Please enter your department";
    if (!data.YourEmail?.trim()) return "Please enter your email";
    if (data.OfficialSRMEmailID?.trim() && !data.OfficialSRMEmailID.endsWith("@srmist.edu.in")) {
      return "If provided, Official SRM Email ID must end with @srmist.edu.in";
    }
    if (!/^\d{10}$/.test(data.ContactNumber || "")) {
      return "Please enter a valid 10-digit contact number";
    }
    if (!/^\d{10}$/.test(data.WhatsAppNumber || "")) {
      return "Please enter a valid 10-digit WhatsApp number";
    }
    if (!data.Year || data.Year === "default") {
      return "Please select your year";
    }
    if (!data.Hostel || data.Hostel === "default") {
      return "Please select your hostel";
    }
    if (!data.Workshop || data.Workshop === "default") {
      return "Please select a workshop";
    }
    if (!data.TransactionID?.trim()) {
      return "Please enter the UTR/Transaction ID from your UPI app";
    }
    if (!/^\d{12}$/.test(data.TransactionID.trim())) {
      return "Wait! The Transaction ID (UTR) must be exactly 12 numerical digits. Check your payment app (GPay, PhonePe, etc).";
    }

    return null;
  }

  async function submitRegistration(
    formData: Record<string, string>,
    transactionId: string
  ) {
    const response = await fetch("/api/payment/submit-manual-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData, transactionId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to submit registration");
    }
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    const formData = getFormData();
    if (!formData) return;
    const validationError = validateForm(formData);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setMessage("");
    setError(false);
    setPaymentError("");
    setPaymentState("submitting");
    setLoading(true);

    try {
      await submitRegistration(
        formData,
        formData.TransactionID.trim()
      );
      setPaymentState("success");
      setTimeout(() => {
        router.push(
          `/workshopReg2/success?transactionId=${formData.TransactionID.trim()}`
        );
      }, 1500);
    } catch (err: any) {
      console.error("Submission error:", err);
      setPaymentState("failed");
      const reason = err.message || "Something went wrong. Please try again.";
      setPaymentError(reason);
      setLoading(false);
      setTimeout(() => {
        router.push(`/workshopReg2/failed?reason=${encodeURIComponent(reason)}`);
      }, 3000);
    }
  }

  function resetPayment() {
    setPaymentState("idle");
    setPaymentError("");
    setMessage("");
    setLoading(false);
    setError(false);
  }

  /* ─────── Payment status overlay ─────── */
  function renderPaymentOverlay() {
    if (paymentState === "idle") return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
        <div className="relative bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-700/40 rounded-3xl p-10 max-w-md w-full mx-4 shadow-[0_0_80px_-12px_rgba(225,29,72,0.25)]">
          {/* subtle glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />



          {paymentState === "submitting" && (
            <div className="text-center relative z-10">
              <div className="w-20 h-20 mx-auto mb-5 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <h3 className="text-2xl text-white font-bold mb-2">
                Registering You
              </h3>
              <p className="text-gray-400 text-sm">
                Submitting your registration...
              </p>
            </div>
          )}

          {paymentState === "success" && (
            <div className="text-center relative z-10">
              <div className="w-24 h-24 mx-auto mb-5 bg-emerald-500/15 rounded-full flex items-center justify-center ring-2 ring-emerald-500/30">
                <svg
                  className="w-12 h-12 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-2xl text-white font-bold mb-2">
                Registration Successful! 🎉
              </h3>
              <p className="text-emerald-400 text-sm">
                Redirecting to confirmation page...
              </p>
            </div>
          )}

          {paymentState === "failed" && (
            <div className="text-center relative z-10">
              <div className="w-24 h-24 mx-auto mb-5 bg-red-500/15 rounded-full flex items-center justify-center ring-2 ring-red-500/30">
                <svg
                  className="w-12 h-12 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h3 className="text-2xl text-white font-bold mb-2">
                Payment Failed
              </h3>
              <p className="text-gray-400 text-sm mb-5">{paymentError}</p>
              <button
                onClick={resetPayment}
                className="px-8 py-3 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─────── RENDER ─────── */
  return (
    <div className="App">
      {/* <Header /> */}
      {renderPaymentOverlay()}

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-rose-500/5 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center pt-8 md:pt-10 pb-4 px-5 md:px-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium mb-4 md:mb-5 tracking-wide">
            <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-pulse" />
            REGISTRATIONS OPEN
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 md:mb-3">
            SolidWorks & Altium{" "}
            <span className="bg-gradient-to-r from-rose-500 to-red-400 bg-clip-text text-transparent">
              Workshops
            </span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
            Master 3D CAD modeling and PCB designing with hands-on projects. From basics to
            advanced simulations guided by industry certified mentors.
          </p>
        </div>
      </div>

      {/* Main Content — Payment Card + Form */}
      <div className="max-w-6xl mx-auto px-5 md:px-4 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 md:gap-8 justify-center items-start">
          {/* Payment Card — order 1 on mobile, top-left on desktop */}
          <div className="order-1 lg:col-start-1 lg:row-start-1">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900 border border-gray-700/30 p-6 shadow-2xl shadow-rose-500/5">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(225,29,72,0.06),transparent_70%)] pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-600/10 flex items-center justify-center border border-rose-500/20">
                    <svg
                      className="w-5 h-5 text-rose-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg leading-tight">
                      Pay via UPI
                    </h4>
                    <p className="text-gray-500 text-xs">
                      Scan or copy the UPI ID below
                    </p>
                  </div>
                </div>

                {/* Price highlight */}
                <div className="bg-gradient-to-r from-rose-500/10 to-transparent border border-rose-500/15 rounded-xl p-4 mb-5">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-400 text-xs uppercase tracking-wider">
                        Workshop Fee
                      </p>
                      <p className="text-white font-bold text-3xl mt-0.5">
                        ₹599
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-medium rounded-full">
                        One-Time
                      </span>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <div className="w-full aspect-square bg-white rounded-xl mb-5 flex items-center justify-center p-2 shadow-inner overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/upi-qr.jpg"
                    alt="Scan to Pay via UPI"
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>

                <div className="space-y-3 mb-5">
                  <div className="flex items-center justify-between bg-gray-800/80 border border-gray-700/50 rounded-lg px-4 py-3 shadow-inner">
                    <span className="text-gray-300 font-mono text-sm tracking-widest font-medium">
                      81045352551-2@ybl
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const upiId = "81045352551-2@ybl";
                        if (navigator.clipboard && window.isSecureContext) {
                          navigator.clipboard.writeText(upiId).then(() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }).catch(() => {
                            // Fallback
                            const ta = document.createElement("textarea");
                            ta.value = upiId;
                            ta.style.position = "fixed";
                            ta.style.opacity = "0";
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand("copy");
                            document.body.removeChild(ta);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          });
                        } else {
                          // Fallback for non-secure contexts
                          const ta = document.createElement("textarea");
                          ta.value = upiId;
                          ta.style.position = "fixed";
                          ta.style.opacity = "0";
                          document.body.appendChild(ta);
                          ta.select();
                          document.execCommand("copy");
                          document.body.removeChild(ta);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }
                      }}
                      className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium border ${copied
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border-rose-500/20"
                        }`}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
                  <span className="text-rose-400 text-xs font-medium text-center w-full leading-relaxed">
                    Please paste the 12-digit UTR/Transaction ID in the form to confirm registration.
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Registration Form — order 2 on mobile, right column on desktop spanning both rows */}
          <div className="order-2 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div className="rounded-2xl bg-gradient-to-br from-gray-900/80 to-gray-950/80 border border-gray-700/30 p-5 md:p-8 shadow-2xl backdrop-blur-sm">
              <h3 className="text-white font-bold text-xl mb-6 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-rose-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                Registration Details
              </h3>

              <form onSubmit={handlePayment} className="space-y-5">
                {/* Name */}
                <div className="relative z-0 w-full group">
                  <input
                    type="text"
                    name="Name"
                    id="Your Name"
                    className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-600 appearance-none focus:outline-none focus:ring-0 focus:border-rose-500 peer transition-colors"
                    placeholder=" "
                    required
                  />
                  <label className="peer-focus:font-medium absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-rose-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                    Your Name
                  </label>
                </div>

                {/* Registration Number */}
                <div className="relative z-0 w-full group">
                  <input
                    type="text"
                    name="FullRegistrationNumber"
                    id="Full Registration Number"
                    className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-600 appearance-none focus:outline-none focus:ring-0 focus:border-rose-500 peer transition-colors"
                    placeholder=" "
                    title="The registration number must start with RA23 or RA24 and be 15 characters long."
                    required
                  />
                  <label className="peer-focus:font-medium absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-rose-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                    Full Registration Number
                  </label>
                </div>

                {/* Department */}
                <div className="relative z-0 w-full group">
                  <input
                    type="text"
                    name="Department"
                    id="Department"
                    className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-600 appearance-none focus:outline-none focus:ring-0 focus:border-rose-500 peer transition-colors"
                    placeholder=" "
                    required
                  />
                  <label className="peer-focus:font-medium absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-rose-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                    Department
                  </label>
                </div>

                {/* Year */}
                <div>
                  <label
                    htmlFor="Year"
                    className="block mb-2 text-sm font-medium text-gray-400"
                  >
                    Year
                  </label>
                  <select
                    required
                    name="Year"
                    id="Year"
                    defaultValue="default"
                    className="w-full bg-gray-800/60 border border-gray-600/50 text-white text-sm rounded-lg p-2.5 focus:ring-rose-500 focus:border-rose-500 transition-colors"
                  >
                    <option disabled value="default">
                      Select one
                    </option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                    <option value="4th">4th</option>
                  </select>
                </div>

                {/* Email row */}
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="relative z-0 w-full group">
                    <input
                      type="email"
                      name="YourEmail"
                      id="Your Email"
                      className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-600 appearance-none focus:outline-none focus:ring-0 focus:border-rose-500 peer transition-colors"
                      placeholder=" "
                      required
                    />
                    <label className="peer-focus:font-medium absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-rose-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                      Your Email
                    </label>
                  </div>
                  <div className="relative z-0 w-full group">
                    <input
                      type="email"
                      name="OfficialSRMEmailID"
                      id="floating_last_name"
                      className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-600 appearance-none focus:outline-none focus:ring-0 focus:border-rose-500 peer transition-colors"
                      placeholder=" "

                    />
                    <label className="peer-focus:font-medium absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-rose-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                      Official SRM Email ID
                    </label>
                  </div>
                </div>

                {/* Phone row */}
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="relative z-0 w-full group">
                    <input
                      type="tel"
                      name="ContactNumber"
                      id="Contact Number"
                      className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-600 appearance-none focus:outline-none focus:ring-0 focus:border-rose-500 peer transition-colors"
                      placeholder=" "
                      required
                    />
                    <label className="peer-focus:font-medium absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-rose-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                      Contact Number
                    </label>
                  </div>
                  <div className="relative z-0 w-full group">
                    <input
                      type="tel"
                      name="WhatsAppNumber"
                      id="WhatsApp Number"
                      className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-600 appearance-none focus:outline-none focus:ring-0 focus:border-rose-500 peer transition-colors"
                      placeholder=" "
                      required
                    />
                    <label className="peer-focus:font-medium absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-rose-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                      WhatsApp Number
                    </label>
                  </div>
                </div>

                {/* Hostel + Room */}
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="Hostel"
                      className="block mb-2 text-sm font-medium text-gray-400"
                    >
                      Hostel / Day-Scholar
                    </label>
                    <select
                      required
                      name="Hostel"
                      id="Hostel"
                      defaultValue="default"
                      onChange={(e) => setHostel(e.target.value)}
                      className="w-full bg-gray-800/60 border border-gray-600/50 text-white text-sm rounded-lg p-2.5 focus:ring-rose-500 focus:border-rose-500 transition-colors"
                    >
                      <option disabled value="default">
                        Select one
                      </option>
                      <option value="Day Scholar">Day Scholar</option>
                      <option value="N Block">N Block</option>
                      <option value="Kaari">Kaari</option>
                      <option value="Paari">Paari</option>
                      <option value="Oori">Oori</option>
                      <option value="Adhyaman">Adhyaman</option>
                      <option value="Nelson Mandela">Nelson Mandela</option>
                      <option value="Sannasi A">Sannasi A</option>
                      <option value="Sannasi C">Sannasi C</option>
                      <option value="Agasthyar">Agasthyar</option>
                      <option value="Malligai">Malligai</option>
                      <option value="Mullai">Mullai</option>
                      <option value="Manoranjitham">Manoranjitham</option>
                      <option value="Thamarai">Thamarai</option>
                      <option value="KC">KC</option>
                      <option value="EsQ">EsQ</option>
                      <option value="M Block">M Block</option>
                      <option value="Meenakshi">Meenakshi</option>
                      <option value="Began">Began</option>
                      <option value="NRI">NRI</option>
                    </select>
                  </div>

                  {!(hostel === "" || hostel === "Day Scholar") && (
                    <div className="relative z-0 w-full group">
                      <input
                        type="tel"
                        name="Room"
                        id="Room"
                        className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-600 appearance-none focus:outline-none focus:ring-0 focus:border-rose-500 peer transition-colors"
                        placeholder=" "
                      />
                      <label className="peer-focus:font-medium absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-rose-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                        Hostel Room Number
                      </label>
                    </div>
                  )}
                </div>

                {/* Workshop select */}
                <div>
                  <label
                    htmlFor="Workshop"
                    className="block mb-2 text-sm font-medium text-gray-400"
                  >
                    Select Workshop
                  </label>
                  <select
                    required
                    name="Workshop"
                    id="Workshop"
                    defaultValue="default"
                    className="w-full bg-gray-800/60 border border-gray-600/50 text-white text-sm rounded-lg p-2.5 focus:ring-rose-500 focus:border-rose-500 transition-colors"
                  >
                    <option disabled value="default">
                      Select one
                    </option>
                    <option value="Solidworks">Solidworks</option>
                    <option value="Altium">Altium</option>
                  </select>
                </div>

                {/* Transaction ID */}
                <div className="relative z-0 w-full group pt-2 pb-2">
                  <input
                    type="text"
                    name="TransactionID"
                    id="TransactionID"
                    pattern="[0-9]{12}"
                    maxLength={12}
                    className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-600 appearance-none focus:outline-none focus:ring-0 focus:border-rose-500 peer transition-colors"
                    placeholder=" "
                    title="Exact 12 digit UTR number from UPI App"
                    required
                  />
                  <label className="peer-focus:font-medium absolute text-sm text-gray-400 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:start-0 peer-focus:text-rose-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6">
                    Transaction ID (12-Digit UPI UTR)
                  </label>
                </div>

                {/* Submit area */}
                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3.5 rounded-xl font-semibold text-white text-base transition-all duration-300 ${loading
                      ? "bg-gray-800 cursor-not-allowed text-gray-500"
                      : "bg-gradient-to-r from-rose-600 via-rose-500 to-red-500 hover:from-rose-500 hover:via-rose-400 hover:to-red-400 shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 hover:scale-[1.01] active:scale-[0.99]"
                      }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="w-5 h-5 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                        Pay ₹599 & Register
                      </span>
                    )}
                  </button>


                </div>
              </form>

              {message && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-white font-medium text-sm text-center">
                  {message}
                </div>
              )}
            </div>
          </div>

          {/* What You Get — order 3 on mobile, bottom-left on desktop */}
          <div className="order-3 lg:col-start-1 lg:row-start-2">
            <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-700/30 p-5">
              <h4 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">
                What You Get
              </h4>
              <div className="space-y-2.5">
                {[
                  "Hands-on 3D modeling & PCB sessions",
                  "Industry certified mentors",
                  "ODs and Refreshments (3 Days)",
                  "Official certificate",
                  "Workshop materials & resources",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3 h-3 text-rose-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-gray-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────── FAQ Section ─────── */}
      <div className="max-w-3xl mx-auto px-5 md:px-4 py-10 md:py-16">
        <div className="text-center mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4 tracking-wide">
            GOT QUESTIONS?
          </div>
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-3">
            Frequently Asked{" "}
            <span className="bg-gradient-to-r from-rose-500 to-red-400 bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
          <p className="text-gray-400 text-sm md:text-base">
            Everything you need to know about the Workshops
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={`rounded-xl border transition-all duration-300 ${openFaq === i
                ? "bg-gray-900/80 border-rose-500/30 shadow-lg shadow-rose-500/5"
                : "bg-gray-900/40 border-gray-700/30 hover:border-gray-600/50"
                }`}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 md:p-5 text-left"
              >
                <span
                  className={`font-medium text-sm md:text-base transition-colors ${openFaq === i ? "text-white" : "text-gray-300"
                    }`}
                >
                  {faq.q}
                </span>
                <svg
                  className={`w-5 h-5 flex-shrink-0 ml-3 transition-transform duration-300 ${openFaq === i
                    ? "rotate-180 text-rose-400"
                    : "text-gray-500"
                    }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-40 pb-5" : "max-h-0"
                  }`}
              >
                <p className="px-5 text-gray-400 text-sm leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contact bar */}
      <div className="text-center pb-8">
        <p className="text-gray-500 text-sm">
          Still have questions? Reach out on Instagram{" "}
          <a
            href="https://www.instagram.com/srmteamrobocon/"
            className="text-rose-400 hover:text-rose-300 hover:underline transition-colors font-medium"
          >
            @srmteamrobocon
          </a>
        </p>
      </div>

      {/* <Footer /> */}
    </div>
  );
}

"use client";

import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
        <div className="text-6xl mb-6">✅</div>
        <h1 className="text-2xl font-bold text-white mb-4">Payment Received!</h1>
        <p className="text-gray-400 mb-6">
          Thank you for your subscription! Your payment has been received and your account 
          will be activated after admin verification.
        </p>
        
        <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4 mb-6">
          <p className="text-blue-200 text-sm">
            <strong>What happens next?</strong><br />
            Our team will verify your payment and activate your account within 24 hours. 
            You will receive full access to all features once approved.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/auth/login"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Go to Login
          </Link>
          <Link
            href="/"
            className="block text-gray-400 hover:text-white text-sm"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

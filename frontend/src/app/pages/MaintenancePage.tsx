import { Wrench } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="fixed top-0 inset-x-0 h-1 bg-gradient-to-r from-pink-500 via-red-500 via-orange-500 via-yellow-400 via-lime-500 to-sky-500" />

      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-100 to-orange-100 flex items-center justify-center mx-auto mb-6">
          <Wrench size={36} className="text-pink-500" />
        </div>

        <h1 className="text-4xl font-black text-gray-900 mb-3">
          We'll be right back
        </h1>
        <p className="text-gray-500 text-base leading-relaxed mb-8">
          We're doing a bit of maintenance to make things even better for you.
          <br />Check back again shortly.
        </p>

        <div className="h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent mb-8" />

        <p className="text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Dear Body. All rights reserved.
        </p>
      </div>
    </div>
  );
}

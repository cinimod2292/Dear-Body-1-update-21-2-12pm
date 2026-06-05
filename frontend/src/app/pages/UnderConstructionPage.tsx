import { Sparkles } from "lucide-react";
import logoImage from "../../assets/2f83d3b5e95347ddf4ffa7687e1ec032dc27ba54.png";

export default function UnderConstructionPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top accent bar */}
      <div className="fixed top-0 inset-x-0 h-1 bg-gradient-to-r from-pink-500 via-red-500 via-orange-500 via-yellow-400 via-lime-500 to-sky-500" />

      <div className="relative z-10 w-full max-w-lg text-center">
        {/* Logo — inverted so it's legible on dark background */}
        <img
          src={logoImage}
          alt="Dear Body"
          className="h-10 w-auto object-contain mx-auto mb-12 brightness-0 invert opacity-60"
        />

        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500/20 to-orange-500/20 border border-white/10 flex items-center justify-center mx-auto mb-6">
          <Sparkles size={36} className="text-pink-400" />
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
          Something exciting<br />is coming
        </h1>
        <p className="text-gray-400 text-lg leading-relaxed mb-10">
          We're crafting something special, just for you.
          <br />Stay tuned.
        </p>

        {/* Gradient accent bar */}
        <div className="h-1 rounded-full bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-400 w-24 mx-auto mb-12" />

        <p className="text-sm text-gray-600">
          &copy; {new Date().getFullYear()} Dear Body. All rights reserved.
        </p>
      </div>
    </div>
  );
}

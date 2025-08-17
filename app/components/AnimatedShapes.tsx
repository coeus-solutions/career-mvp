'use client';

export default function AnimatedShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating abstract shapes */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-gradient-to-br from-[#E6E9FF] to-[#B8C5FF] opacity-30 blur-3xl animate-float" />
      <div className="absolute top-40 right-20 w-96 h-96 rounded-full bg-gradient-to-br from-[#B8C5FF] to-[#7B93FF] opacity-20 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-20 left-1/3 w-80 h-80 rounded-full bg-gradient-to-br from-[#4169E1] to-[#B8C5FF] opacity-20 blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      
      {/* Additional smaller shapes */}
      <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-[#E6E9FF] opacity-40 blur-2xl animate-pulse-slow" />
      <div className="absolute bottom-1/3 left-1/4 w-32 h-32 rounded-full bg-[#B8C5FF] opacity-30 blur-2xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
    </div>
  );
}
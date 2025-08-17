export default function CaseyLogo({ size = 'default' }: { size?: 'small' | 'default' | 'large' }) {
  const sizes = {
    small: {
      bars: 'w-2 h-6 h-8 h-10',
      text: 'text-xl',
      gap: 'gap-2'
    },
    default: {
      bars: 'w-3 h-8 h-12 h-16',
      text: 'text-3xl',
      gap: 'gap-3'
    },
    large: {
      bars: 'w-4 h-12 h-16 h-20',
      text: 'text-5xl',
      gap: 'gap-4'
    }
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex items-center ${currentSize.gap}`}>
      {/* Stacked bars logo */}
      <div className="flex items-end gap-1">
        <div className={`${size === 'small' ? 'w-2 h-6' : size === 'large' ? 'w-4 h-12' : 'w-3 h-8'} bg-[#4169E1] rounded-sm`} />
        <div className={`${size === 'small' ? 'w-2 h-8' : size === 'large' ? 'w-4 h-16' : 'w-3 h-12'} bg-[#4169E1] rounded-sm`} />
        <div className={`${size === 'small' ? 'w-2 h-10' : size === 'large' ? 'w-4 h-20' : 'w-3 h-16'} bg-[#4169E1] rounded-sm`} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`${currentSize.text} font-bold text-black`}>CASEY</span>
        <span className={`${size === 'small' ? 'text-sm' : size === 'large' ? 'text-2xl' : 'text-lg'} text-black`}>©</span>
      </div>
    </div>
  );
}
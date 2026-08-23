import { Menu } from "lucide-react";

function Topbar({ onMenuClick }) {
  return (
    <header className="flex h-[76px] items-center justify-between border-b border-[#e7e4ea] bg-white px-4 sm:px-6 md:px-[34px]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[#e7e4ea] text-[#5f259f] hover:bg-[#faf8fc] md:hidden"
          aria-label="Open navigation"
        >
          <Menu size={19} />
        </button>

        <div className="text-[11px] text-[#85818c]">
          Overview / Dashboard
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-[18px]">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#16a34a]">
          <span className="h-[7px] w-[7px] rounded-full bg-[#16a34a] shadow-[0_0_8px_rgba(22,163,74,0.45)]" />

          <span className="hidden sm:inline">Live</span>
        </div>

        <div className="grid h-8 w-8 place-items-center rounded-[9px] border border-[#dfd4e9] bg-[rgba(95,37,159,0.09)] text-[10px] font-bold text-[#4b1f7a]">
          AS
        </div>
      </div>
    </header>
  );
}

export default Topbar;
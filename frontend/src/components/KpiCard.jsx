function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  iconClass = "text-[#5f259f] bg-[rgba(95,37,159,0.09)]",
}) {
  return (
    <div className="rounded-[11px] border border-[#e7e4ea] bg-white p-[17px] shadow-[0_1px_2px_rgba(30,20,40,0.02)] transition hover:-translate-y-px hover:shadow-[0_7px_20px_rgba(30,20,40,0.05)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#6b6b75]">
          {label}
        </span>

        <div
          className={`grid h-[31px] w-[31px] place-items-center rounded-lg ${iconClass}`}
        >
          <Icon size={18} />
        </div>
      </div>

      <div className="mt-[15px] text-[25px] font-bold tracking-[-0.7px]">
        {value}
      </div>

      <div className="mt-[7px] flex items-center gap-1 text-[10px] text-[#16a34a]">
        {change}
      </div>
    </div>
  );
}

export default KpiCard;
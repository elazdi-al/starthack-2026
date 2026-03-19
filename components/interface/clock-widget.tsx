"use client";

export function ClockWidget() {
  return (
    <div className="relative">
      <div className="bg-black rounded-lg flex justify-center items-center w-30 h-10">
        <p className="text-white text-base whitespace-nowrap leading-5">
          17:33 GMT-5
        </p>
      </div>
    </div>
  );
}

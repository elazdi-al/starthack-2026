import { cn } from "@/lib/utils";

function TrashIcon() {
  return (
    <svg
      height="16"
      strokeLinejoin="round"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        clipRule="evenodd"
        d="M6.75 2.75C6.75 2.05964 7.30964 1.5 8 1.5C8.69036 1.5 9.25 2.05964 9.25 2.75V3H6.75V2.75ZM5.25 3V2.75C5.25 1.23122 6.48122 0 8 0C9.51878 0 10.75 1.23122 10.75 2.75V3H12.9201H14.25H15V4.5H14.25H13.8846L13.1776 13.6917C13.0774 14.9942 11.9913 16 10.6849 16H5.31508C4.00874 16 2.92263 14.9942 2.82244 13.6917L2.11538 4.5H1.75H1V3H1.75H3.07988H5.25ZM4.31802 13.5767L3.61982 4.5H12.3802L11.682 13.5767C11.6419 14.0977 11.2075 14.5 10.6849 14.5H5.31508C4.79254 14.5 4.3581 14.0977 4.31802 13.5767Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function HoldToDelete({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mobile-full-width relative mb-[35px] mt-8 w-full rounded-xl border-b border-t border-[#e9e9e7] bg-white text-[16px] text-[#21201c] dark:border-[#2a2a28] dark:bg-[#11110E] sm:border-none sm:shadow-[0_0_0_1px_rgba(0,0,0,.08),0px_2px_2px_rgba(0,0,0,.04)] sm:dark:shadow-[inset_0_0_0_1px_hsla(0,0%,100%,.07)]",
        className
      )}
    >
      <div className="light flex h-[264px] w-full items-center justify-center px-4 py-6 sm:rounded-xl">
        <button className="hold-to-delete_button__aAKjf" type="button">
          <div
            aria-hidden="true"
            className="hold-to-delete_deleteSection__ZIN1l"
          >
            <TrashIcon />
            Hold to Delete
          </div>
          <TrashIcon />
          Hold to Delete
        </button>
      </div>
    </div>
  );
}

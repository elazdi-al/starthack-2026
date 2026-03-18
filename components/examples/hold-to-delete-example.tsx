import { TrashCanIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function HoldToDeleteExample({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mobile-full-width relative mb-[35px] mt-8 w-full rounded-xl border-b border-t border-[#e9e9e7] bg-white text-[16px] text-[#21201c] dark:border-[#2a2a28] dark:bg-[#11110E] sm:border-none sm:shadow-[0_0_0_1px_rgba(0,0,0,.08),0px_2px_2px_rgba(0,0,0,.04)] sm:dark:shadow-[inset_0_0_0_1px_hsla(0,0%,100%,.07)]",
        className
      )}
    >
      <div className="light flex h-[264px] w-full items-center justify-center px-4 py-6 sm:rounded-xl">
        <button className="hold-to-delete-button" type="button">
          <span className="hold-to-delete-button__wrapper">
            <span className="hold-to-delete-button__content">
              <span className="hold-to-delete-button__icon">
                <TrashCanIcon size={16} />
              </span>
              <span className="hold-to-delete-button__label">
                Hold to Delete
              </span>
            </span>
            <span
              aria-hidden="true"
              className="hold-to-delete-button__overlay"
            >
              <span className="hold-to-delete-button__icon">
                <TrashCanIcon size={16} />
              </span>
              <span className="hold-to-delete-button__label">
                Hold to Delete
              </span>
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

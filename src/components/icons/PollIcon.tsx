import questionAndAnswerAsset from "@/assets/question-and-answer.png.asset.json";

interface PollIconProps {
  className?: string;
}

const PollIcon = ({ className }: PollIconProps) => (
  <span
    className={className}
    style={{
      display: "inline-block",
      maskImage: `url(${questionAndAnswerAsset.url})`,
      WebkitMaskImage: `url(${questionAndAnswerAsset.url})`,
      maskSize: "contain",
      WebkitMaskSize: "contain",
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskPosition: "center",
    }}
  />
);

export default PollIcon;

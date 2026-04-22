import { useSearchParams } from "react-router-dom";

/** Returns true when ?embed=true is in the URL — hides header/footer for iframe embedding. */
export const useEmbedMode = () => {
  const [searchParams] = useSearchParams();
  return searchParams.get("embed") === "true";
};

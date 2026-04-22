import { createRoot } from "react-dom/client";
import { initErrorReporting } from "@/lib/errorReporting";
import App from "./App.tsx";
import "./index.css";

initErrorReporting();

createRoot(document.getElementById("root")!).render(<App />);

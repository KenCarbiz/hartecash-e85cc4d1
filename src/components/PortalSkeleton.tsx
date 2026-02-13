import { motion } from "framer-motion";
import loadingCar from "@/assets/loading-car.svg";

const PortalSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className="text-center"
    >
      <img src={loadingCar} alt="Loading" className="w-24 h-24 mx-auto mb-4 opacity-80" />
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-sm font-medium text-muted-foreground"
      >
        Loading your submission...
      </motion.div>
    </motion.div>
  </div>
);

export default PortalSkeleton;

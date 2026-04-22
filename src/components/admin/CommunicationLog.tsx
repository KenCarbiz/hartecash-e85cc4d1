import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FollowUpLog from "./FollowUpLog";
import NotificationLog from "./NotificationLog";
import { Send, ScrollText } from "lucide-react";

const CommunicationLog = () => (
  <div>
    <Tabs defaultValue="follow-ups" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="follow-ups" className="gap-1.5">
          <Send className="w-3.5 h-3.5" />
          Follow-Ups
        </TabsTrigger>
        <TabsTrigger value="notifications" className="gap-1.5">
          <ScrollText className="w-3.5 h-3.5" />
          Notification Log
        </TabsTrigger>
      </TabsList>
      <TabsContent value="follow-ups"><FollowUpLog /></TabsContent>
      <TabsContent value="notifications"><NotificationLog /></TabsContent>
    </Tabs>
  </div>
);

export default CommunicationLog;

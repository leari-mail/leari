import { useDefaultLayout } from "react-resizable-panels";

import { MessageList } from "@components/messages";
import { MessageReader } from "@components/reader";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@ui";

import { Sidebar } from "./Sidebar";

/** Classic three-pane mail layout: sidebar · message list · reader. */
export function AppShell() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "leari.layout",
    storage: localStorage,
  });

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      className="h-full"
    >
      <ResizablePanel
        id="sidebar"
        defaultSize={230}
        minSize={180}
        maxSize={320}
        groupResizeBehavior="preserve-pixel-size"
      >
        <Sidebar />
      </ResizablePanel>
      <ResizableHandle className="bg-sidebar-border" />
      <ResizablePanel
        id="list"
        defaultSize={360}
        minSize={280}
        maxSize={560}
        groupResizeBehavior="preserve-pixel-size"
      >
        <MessageList />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="reader" minSize={320}>
        <MessageReader />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

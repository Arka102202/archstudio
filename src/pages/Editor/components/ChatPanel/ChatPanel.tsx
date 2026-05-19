import React, { useState } from 'react'
import { useChatPanel } from './useChatPanel'
import { SessionHeader } from './components/SessionHeader'
import { MessageThread } from './components/MessageThread'
import { ChatInput } from './components/ChatInput'
import type { ChatPanelProps } from './types'

const ChatPanel = ({ projectId }: ChatPanelProps): React.JSX.Element => {
  const [chatView, setChatView] = useState<'chat' | 'history'>('chat')

  const {
    msNodes,
    activeMsId,
    sessions,
    activeChatSessionId,
    messages,
    isLoading,
    isSendingArchitecture,
    handleMsChange,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession,
    handleSendMessage,
    handleStopGeneration,
    handleToggleArchitecture,
  } = useChatPanel(projectId)

  const activeSession = sessions.find(s => s.id === activeChatSessionId) ?? null

  const handleSelectSessionAndSwitch = async (sessionId: string): Promise<void> => {
    await handleSelectSession(sessionId)
    setChatView('chat')
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--color-surface)',
    }}>
      <SessionHeader
        msNodes={msNodes}
        activeMsId={activeMsId}
        sessions={sessions}
        activeChatSessionId={activeChatSessionId}
        isLoading={isLoading}
        chatView={chatView}
        onChatViewChange={setChatView}
        onMsChange={handleMsChange}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSessionAndSwitch}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />
      <div style={{ flex: 1, overflow: 'hidden', display: chatView === 'chat' ? 'flex' : 'none', flexDirection: 'column' }}>
        <MessageThread
          messages={messages}
          session={activeSession}
          isLoading={isLoading}
        />
        <ChatInput
          isLoading={isLoading}
          isSendingArchitecture={isSendingArchitecture}
          onSend={handleSendMessage}
          onStop={handleStopGeneration}
          onToggleArchitecture={handleToggleArchitecture}
        />
      </div>
    </div>
  )
}

export default ChatPanel

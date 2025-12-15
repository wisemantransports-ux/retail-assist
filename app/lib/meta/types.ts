export interface AutomationRule {
  id: string;
  workspace_id: string;
  enabled: boolean;
  trigger_words?: string[];
  auto_reply_message?: string;
  send_public_reply?: boolean;
  public_reply_template?: string;
}

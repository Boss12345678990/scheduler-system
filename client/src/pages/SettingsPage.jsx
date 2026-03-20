import './SettingsPage.css';

export default function SettingsPage() {
  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <p className="settings-subtitle">System configuration and preferences</p>

      <div className="settings-card">
        <h2>General</h2>
        <div className="setting-item">
          <div>
            <p className="setting-label">Application Name</p>
            <p className="setting-desc">The name displayed in the sidebar</p>
          </div>
          <input type="text" defaultValue="WorkSync" disabled />
        </div>
        <div className="setting-item">
          <div>
            <p className="setting-label">Time Zone</p>
            <p className="setting-desc">Timezone for scheduling</p>
          </div>
          <input type="text" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone} disabled />
        </div>
      </div>

      <div className="settings-card">
        <h2>AI Assistant</h2>
        <div className="setting-item">
          <div>
            <p className="setting-label">AI Model</p>
            <p className="setting-desc">Configure in server .env file</p>
          </div>
          <span className="badge badge-active">Gemini 2.0 Flash</span>
        </div>
      </div>
    </div>
  );
}

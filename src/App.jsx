import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Save, LogOut, KeyRound, Sparkles, CheckCircle2 } from 'lucide-react';

const STORAGE_PREFIX = 'champ2026_team_';
const API_KEY_STORAGE = 'champ2026_scenario_apikey';

const PROMPT_GET_FEEDBACK = `당신은 대한민국 학생창의력 챔피언대회 오디션 시스템의 보조 멘토 AI입니다.
사용자가 제출한 시나리오를 분석하여, 다음 5대 필수 요소가 잘 반영되었는지 확인하고 피드백을 제공합니다.
[5대 필수 요소]
1. 배너 광고 (8절 도화지 1장)
2. 장면 전환 연출
3. 신 스틸러
4. 별난 AI
5. 기발한 우승 상품 (8절 도화지 1장)

규칙 1: 절대 사용자가 제출한 시나리오의 시간적/공간적 범위를 넘어서 뒷이야기를 임의로 창작하면 안 됩니다.
규칙 2: 부족한 요소를 보완할 수 있는 창의적인 피드백 선택지 3개를 제안하세요.
규칙 3: 반드시 아래 JSON 포맷만을 반환하세요 (마크다운 백틱 없이 순수 JSON만).
{
  "analysis": "현재 시나리오에 대한 칭찬과 보완점에 대한 친절한 분석 (200자 이내)",
  "options": [
    {
      "id": "opt1",
      "title": "선택지 1 짧은 제목",
      "description": "이 선택지를 골랐을 때 시나리오에 구체적으로 어떤 내용이 추가되거나 변경되는지 설명"
    },
    { "id": "opt2", "title": "...", "description": "..." },
    { "id": "opt3", "title": "...", "description": "..." }
  ]
}`;

const PROMPT_APPLY_OPTION = `당신은 시나리오 수정 AI입니다. 아래 '원본 시나리오'에 '사용자가 선택한 피드백 방향'을 반영하여 시나리오를 자연스럽게 수정하세요.
절대로 원본의 이야기 전개를 뛰어넘어 뒷이야기를 새로 지어내지 마세요.
오직 선택된 피드백 요소를 기존 장면에 자연스럽게 녹여넣는 것에만 집중하세요.
출력은 수정된 시나리오 텍스트 본문만 반환해야 합니다. 다른 말은 덧붙이지 마세요.`;

function App() {
  const [teamName, setTeamName] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem(API_KEY_STORAGE) || '');
  
  const [teamData, setTeamData] = useState(null);
  const [scenario, setScenario] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);
  
  const [isApplying, setIsApplying] = useState(false);

  // Login Handle
  const handleLogin = (e) => {
    e?.preventDefault();
    if (!teamName.trim()) return;
    
    const raw = localStorage.getItem(STORAGE_PREFIX + teamName.trim());
    if (raw) {
      try {
        const data = JSON.parse(raw);
        setTeamData(data);
        setScenario(data.scenario || '');
        setIsLogged(true);
      } catch (err) {
        console.error(err);
        alert('데이터를 불러오는데 실패했습니다.');
      }
    } else {
      alert('해당 팀명으로 저장된 데이터가 없습니다. 먼저 이전 웹앱에서 해결계획서와 시나리오를 작성해주세요.');
    }
  };

  const handleLogout = () => {
    setIsLogged(false);
    setTeamName('');
    setTeamData(null);
    setScenario('');
    setFeedbackData(null);
  };

  const handleSaveApiKey = () => {
    localStorage.setItem(API_KEY_STORAGE, apiKey);
    alert('API Key가 브라우저에 저장되었습니다.');
  };

  const saveCurrentScenario = () => {
    if (!teamData) return;
    const newData = { ...teamData, scenario: scenario };
    localStorage.setItem(STORAGE_PREFIX + teamName, JSON.stringify(newData));
    setTeamData(newData);
    alert('수정된 시나리오가 현재 팀 데이터에 저장되었습니다.');
  };

  const getGeminiModel = (sysPrompt) => {
    if (!apiKey) throw new Error("API Key가 필요합니다.");
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-preview-05-20",
      systemInstruction: sysPrompt 
    });
  };

  const requestFeedback = async () => {
    if (!scenario || scenario.trim() === '') {
      alert('시나리오 내용이 없습니다.');
      return;
    }
    try {
      setIsAnalyzing(true);
      setFeedbackData(null);
      const model = getGeminiModel(PROMPT_GET_FEEDBACK);
      
      const userMessage = `[팀 정보]
원작: ${teamData.f_original || '미입력'}
주인공: ${teamData.f_protagonist || '미입력'}
[현재 시나리오]
${scenario}`;

      const result = await model.generateContent(userMessage);
      const output = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      
      const parsed = JSON.parse(output);
      setFeedbackData(parsed);
    } catch (err) {
      console.error(err);
      alert('분석 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyOption = async (option) => {
    try {
      setIsApplying(true);
      const model = getGeminiModel(PROMPT_APPLY_OPTION);
      
      const userMessage = `[원본 시나리오]
${scenario}

[사용자가 선택한 피드백 방향]
${option.title}: ${option.description}`;

      const result = await model.generateContent(userMessage);
      const modifiedScenario = result.response.text();
      
      setScenario(modifiedScenario);
      setFeedbackData(null); // 초기화
    } catch (err) {
      console.error(err);
      alert('시나리오 수정 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isLogged) {
    return (
      <div className="modal-overlay">
        <div className="modal-box">
          <div className="modal-logo">✍️</div>
          <div className="modal-title">시나리오 피드백 & 작성 앱</div>
          <div className="modal-sub">기존 팀명을 입력하면 작성하던 시나리오 데이터를 불러옵니다.</div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input 
              type="text" 
              className="modal-input" 
              placeholder="팀명을 입력하세요 (예: 별난창의팀)" 
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            <button type="submit" className="modal-btn-primary">입장하기 →</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header>
        <div>
          <h1>🏆 2026 학생창의력 챔피언대회 – 시나리오 작성 시스템</h1>
          <div className="sub">시나리오 피드백 및 선택형 자동 수정 앱</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="api-bar">
            <KeyRound size={14} style={{ color: 'var(--muted)' }} />
            <input 
              type="password" 
              placeholder="Gemini API Key" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button className="modal-btn-primary" style={{ width: 'auto', padding: '4px 10px', fontSize: '0.75rem' }} onClick={handleSaveApiKey}>
              저장
            </button>
          </div>
          
          <div className="team-bar">
            <span>👥</span>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>현재 연동된 팀</div>
              <div className="team-name-val">{teamName}</div>
            </div>
            <button className="modal-btn-primary" style={{ width: 'auto', padding: '4px 10px', fontSize: '0.75rem', marginLeft: '10px' }} onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="main">
        {/* AREA A: Current Scenario */}
        <div className="area-a">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '7px', marginBottom: '8px' }}>
            <div className="section-title" style={{ borderBottom: 'none', margin: 0, padding: 0 }}>
              <span className="badge" style={{ background: 'var(--accent2)', color: '#000', padding: '2px 6px', marginRight: '6px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 700 }}>작업중</span>
              현재 시나리오
            </div>
            <button onClick={saveCurrentScenario} style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Save size={14} /> 저장하기
            </button>
          </div>
          
          <div className="data-summary">
            <strong>불러온 기본 정보:</strong><br/>
            <ul>
              <li>원작: {teamData?.f_original || '-'}</li>
              <li>주인공: {teamData?.f_protagonist || '-'}</li>
              <li>오디션: {teamData?.f_audition || '-'}</li>
            </ul>
          </div>

          <div className="scenario-area">
            <textarea 
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="시나리오를 여기에 작성하세요."
            />
          </div>
        </div>

        {/* AREA B: AI Feedback */}
        <div className="area-b">
          <div className="feedback-container">
            <div className="section-title">
              <Sparkles size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
              AI 피드백 및 시나리오 보완
            </div>

            {!feedbackData && !isAnalyzing && !isApplying && (
              <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.6 }}>
                  해결계획서 앱에서 작성해 온 <strong>주제, 단계, 필수 5대 요소</strong>가<br/>
                  현재 시나리오에 골고루, 그리고 범위 내비게이션을 이탈하지 않고 잘 반영되었는지 분석합니다.
                </p>
                <button className="btn-primary" onClick={requestFeedback} style={{ maxWidth: '280px' }}>
                  피드백 방향 분석하기 ↗
                </button>
              </div>
            )}

            {isAnalyzing && (
              <div className="status-box">
                <span className="loading-spinner"></span>
                AI가 시나리오를 읽고 5대 요소를 점검하고 있습니다...
              </div>
            )}
            
            {isApplying && (
              <div className="status-box" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                <span className="loading-spinner" style={{ borderTopColor: 'var(--accent)' }}></span>
                선택하신 피드백을 시나리오에 자연스럽게 녹여내고 있습니다...
              </div>
            )}

            {feedbackData && !isApplying && (
              <div style={{ animation: 'fadeIn 0.4s ease' }}>
                <div className="feedback-card">
                  <h3>📝 종합 분석 결과</h3>
                  <p>{feedbackData.analysis}</p>
                </div>

                <h4 style={{ color: 'var(--accent2)', fontSize: '0.85rem', marginTop: '20px', marginBottom: '10px' }}>
                  이런 방향으로 시나리오를 수정해보는건 어때요? (선택)
                </h4>

                {feedbackData.options?.map((opt, idx) => (
                  <button key={opt.id || idx} className="option-btn" onClick={() => applyOption(opt)}>
                    <strong style={{ display: 'block', color: 'var(--accent)', marginBottom: '5px' }}>{opt.title}</strong>
                    <span style={{ color: 'var(--muted)' }}>{opt.description}</span>
                  </button>
                ))}
                
                <button className="btn-primary" style={{ background: 'var(--panel)', border: '1px solid var(--border)', marginTop: '20px' }} onClick={() => setFeedbackData(null)}>
                  취소 / 다른 부분 수정하기
                </button>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

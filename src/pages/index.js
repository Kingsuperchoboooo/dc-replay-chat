
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import DatePicker from 'react-datepicker';
import styles from '@/styles/Home.module.css';

// Custom Scrollable Time Input Component
const CustomTimeInput = ({ date, value, onChange }) => {
  const valueStr = value || "00:00";
  const [hh, mm] = valueStr.split(':');

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  const hourRef = useRef(null);
  const minuteRef = useRef(null);

  // Auto-scroll to current selection
  useEffect(() => {
    if (hourRef.current) {
      const selectedEl = hourRef.current.querySelector(`.${styles.timeItemSelected}`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'center' });
      }
    }
    if (minuteRef.current) {
      const selectedEl = minuteRef.current.querySelector(`.${styles.timeItemSelected}`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'center' });
      }
    }
  }, []);

  const handleHourClick = (h) => {
    onChange(`${h}:${mm}`);
  };

  const handleMinuteClick = (m) => {
    onChange(`${hh}:${m}`);
  };

  return (
    <div className={styles.timePickerContainer}>
      <div className={styles.timeColumn} ref={hourRef}>
        <div className={styles.timeLabel}>Hour</div>
        {hours.map((h) => (
          <div
            key={h}
            className={`${styles.timeItem} ${h === hh ? styles.timeItemSelected : ''}`}
            onClick={() => handleHourClick(h)}
          >
            {h}
          </div>
        ))}
      </div>
      <div style={{ width: '1px', background: 'var(--glass-border)' }}></div>
      <div className={styles.timeColumn} ref={minuteRef}>
        <div className={styles.timeLabel}>Min</div>
        {minutes.map((m) => (
          <div
            key={m}
            className={`${styles.timeItem} ${m === mm ? styles.timeItemSelected : ''}`}
            onClick={() => handleMinuteClick(m)}
          >
            {m}
          </div>
        ))}
      </div>
    </div>
  );
};

import { registerLocale } from 'react-datepicker';
import ko from 'date-fns/locale/ko';

registerLocale('ko', ko);

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [displayedPosts, setDisplayedPosts] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [replayTime, setReplayTime] = useState(null); // Date object
  const [speed, setSpeed] = useState(1);
  const [endTime, setEndTime] = useState(null);
  const [heatmap, setHeatmap] = useState([]);

  // Scraper State
  const [mode, setMode] = useState('scrape');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [timeInputValue, setTimeInputValue] = useState(''); // HH:MM:SS input
  // Initialize with current time (or null if preferred, but DatePicker needs date object)
  const [scrapeTime, setScrapeTime] = useState(new Date());

  // Auto-fill from URL Query
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('url');
      if (urlParam) {
        setScrapeUrl(decodeURIComponent(urlParam));
      }
    }
  }, []);

  // Load API Key
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedKey = localStorage.getItem('GEMINI_API_KEY');
      if (storedKey) setApiKey(storedKey);
    }
  }, []);

  // Theme State
  const [theme, setTheme] = useState('dark');

  // Load Theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('THEME') || 'dark';
      setTheme(storedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('THEME', newTheme);
  };



  const [scrapeDuration, setScrapeDuration] = useState(60);
  const [isScraping, setIsScraping] = useState(false);

  // UI State
  const [fontSize, setFontSize] = useState(16);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const messagesEndRef = useRef(null);
  const timerRef = useRef(null);
  const progressBarRef = useRef(null);
  const datePickerRef = useRef(null);

  const [isSyncingDate, setIsSyncingDate] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedPosts]);

  // Preprocess posts to assign virtual timestamps
  const preprocessPosts = (rawPosts) => {
    // Group posts by second
    const groups = {};
    rawPosts.forEach((post) => {
      // Use the raw timestamp string to group, assuming they are consistent
      const key = post.timestamp;
      if (!groups[key]) groups[key] = [];
      groups[key].push(post);
    });

    const processed = [];
    Object.values(groups).forEach((group) => {
      const count = group.length;
      if (count === 1) {
        const post = group[0];
        post.virtualTimestamp = new Date(post.timestamp).getTime();
        processed.push(post);
      } else {
        // Distribute within the second (0 to 999 ms)
        const interval = 1000 / count;
        group.forEach((post, index) => {
          const baseTime = new Date(post.timestamp).getTime();
          post.virtualTimestamp = baseTime + (interval * index);
          processed.push(post);
        });
      }
    });

    // Final sort by virtual timestamp
    return processed.sort((a, b) => a.virtualTimestamp - b.virtualTimestamp);
  };

  const calculateHeatmap = (processedPosts) => {
    if (processedPosts.length === 0) return;

    const start = processedPosts[0].virtualTimestamp;
    const end = processedPosts[processedPosts.length - 1].virtualTimestamp;
    const duration = end - start;
    if (duration <= 0) return;

    const binCount = 50;
    const binSize = duration / binCount;
    const bins = new Array(binCount).fill(0);

    processedPosts.forEach(p => {
      const offset = p.virtualTimestamp - start;
      const binIndex = Math.min(Math.floor(offset / binSize), binCount - 1);
      bins[binIndex]++;
    });

    const maxCount = Math.max(...bins);
    const normalized = bins.map(count => ({
      count,
      height: count === 0 ? 0 : (count / maxCount) * 100
    }));

    setHeatmap(normalized);
  };

  const handleScrape = async () => {
    if (!scrapeUrl || !scrapeTime) {
      alert('Please enter URL and Start Time');
      return;
    }

    setIsScraping(true);
    // Convert Date object to ISO string or expected format for API
    // The API probably expects an ISO string or a timestamp.
    // Let's ensure we pass a valid string. API expects 'targetTime'
    const targetTimeStr = scrapeTime instanceof Date ? scrapeTime.toISOString() : scrapeTime;

    // Extract Post ID if available (for Binary Search)
    let targetPostId = null;
    try {
      const u = new URL(scrapeUrl);
      // Standard parameter 'no'
      targetPostId = u.searchParams.get('no');

      // Path based ID (e.g. /board/id/12345)
      if (!targetPostId) {
        const match = u.pathname.match(/\/board\/[^/]+\/(\d+)/);
        if (match) targetPostId = match[1];
      }
    } catch (e) {
      console.warn("Failed to parse URL for ID", e);
    }

    try {
      const queryParams = new URLSearchParams({
        url: scrapeUrl,
        targetTime: targetTimeStr,
        duration: scrapeDuration.toString(),
        ...(targetPostId && { targetPostId })
      });
      const res = await fetch(`/api/scrape?${queryParams.toString()}`);
      const data = await res.json();

      if (data.posts && data.posts.length > 0) {
        const smoothPosts = preprocessPosts(data.posts);
        setPosts(smoothPosts);
        setDisplayedPosts([]);
        setCurrentPostIndex(0);

        // Set Start/Replay time to the user's requested Target Time (or first post if earlier)
        const firstPostTime = new Date(smoothPosts[0].virtualTimestamp);
        const requestedTime = new Date(scrapeTime);

        // If fetched posts start way before requested time, we still want to start playing FROM requested time?
        // Or just start from the beginning of what we fetched.
        // Let's start from the first post found (which should be close to targetTime).

        const start = firstPostTime < requestedTime ? firstPostTime : requestedTime;

        setStartTime(start);
        setReplayTime(start);
        setEndTime(new Date(smoothPosts[smoothPosts.length - 1].virtualTimestamp));

        calculateHeatmap(smoothPosts);
      } else {
        alert(data.error || 'No posts found.');
      }
    } catch (e) {
      console.error(e);
      alert('Scraping failed. Check console.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();

    // Send to API
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: text }),
      });

      const data = await res.json();
      if (data.posts && data.posts.length > 0) {
        const smoothPosts = preprocessPosts(data.posts);
        setPosts(smoothPosts);
        setDisplayedPosts([]);
        setCurrentPostIndex(0);

        const firstTime = new Date(smoothPosts[0].virtualTimestamp);
        const lastTime = new Date(smoothPosts[smoothPosts.length - 1].virtualTimestamp);
        setStartTime(firstTime);
        setEndTime(lastTime);
        setReplayTime(firstTime);

        calculateHeatmap(smoothPosts);
      } else {
        alert('No posts found in this file. Make sure it is a DC Inside Gallery List.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to parse file.');
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      clearInterval(timerRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      // Update every 100ms
      timerRef.current = setInterval(() => {
        setReplayTime((prev) => {
          const nextTime = new Date(prev.getTime() + (100 * speed));
          if (endTime && nextTime > endTime) {
            clearInterval(timerRef.current);
            setIsPlaying(false);
            return endTime;
          }
          return nextTime;
        });
      }, 100);
    }
  };

  // Update interval when speed changes while playing
  useEffect(() => {
    if (isPlaying) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setReplayTime((prev) => {
          const nextTime = new Date(prev.getTime() + (100 * speed));
          if (endTime && nextTime > endTime) {
            clearInterval(timerRef.current);
            setIsPlaying(false);
            return endTime;
          }
          return nextTime;
        });
      }, 100);
    }
  }, [speed]);

  // Replay Logic
  useEffect(() => {
    if (!replayTime || posts.length === 0) return;

    const currentReplayTs = replayTime.getTime();

    // Check for Rewind
    if (displayedPosts.length > 0) {
      const lastDisplayed = displayedPosts[displayedPosts.length - 1];
      if (lastDisplayed.virtualTimestamp > currentReplayTs) {
        // Rerender from start
        const relevant = posts.filter(p => p.virtualTimestamp <= currentReplayTs);
        setDisplayedPosts(relevant);
        setCurrentPostIndex(relevant.length);
        return;
      }
    }

    // Forward Playback
    let nextIndex = currentPostIndex;
    const newMessages = [];

    while (nextIndex < posts.length) {
      const post = posts[nextIndex];
      if (post.virtualTimestamp <= currentReplayTs) {
        newMessages.push(post);
        nextIndex++;
      } else {
        break;
      }
    }

    if (newMessages.length > 0) {
      setDisplayedPosts((prev) => [...prev, ...newMessages]);
      setCurrentPostIndex(nextIndex);
    }

  }, [replayTime, posts]);

  // Format Replay Time
  const formatTime = (date) => {
    if (!date) return '00:00:00';
    return date.toTimeString().split(' ')[0];
  };

  // Seek & Jump
  const handleJump = (seconds) => {
    if (!replayTime) return;
    const newTime = new Date(replayTime.getTime() + (seconds * 1000));
    // Clamp
    if (startTime && newTime < startTime) setReplayTime(startTime);
    else if (endTime && newTime > endTime) setReplayTime(endTime);
    else setReplayTime(newTime);
  };

  const handleSeek = (e) => {
    if (!startTime || !endTime || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;

    const totalDuration = endTime.getTime() - startTime.getTime();
    const newTs = startTime.getTime() + (totalDuration * percentage);
    setReplayTime(new Date(newTs));
  };

  const handleTimeInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); // Digits only
    if (val.length > 6) val = val.slice(0, 6);

    if (val.length > 4) {
      val = `${val.slice(0, 2)}:${val.slice(2, 4)}:${val.slice(4)}`;
    } else if (val.length > 2) {
      val = `${val.slice(0, 2)}:${val.slice(2)}`;
    }
    setTimeInputValue(val);
  };

  const handleTimeInput = (e) => {
    if (e.key === 'Enter') {
      const input = timeInputValue; // Use controlled state
      if (!startTime) return;

      const parts = input.split(':').map(Number);
      // Valid if we have at least H, M (S is optional?) Or strict HH:MM:SS.
      // Logic above enforces auto-colon, so we likely have H:M:S or partial.
      // Let's support partial: H, H:M, H:M:S
      let h = 0, m = 0, s = 0;
      if (parts.length >= 1) h = parts[0];
      if (parts.length >= 2) m = parts[1];
      if (parts.length >= 3) s = parts[2];

      if (isNaN(h) || isNaN(m) || isNaN(s)) return;

      const newDate = new Date(startTime);
      newDate.setHours(h);
      newDate.setMinutes(m);
      newDate.setSeconds(s);

      setReplayTime(newDate);
      setTimeInputValue(''); // Clear input
    }
  };

  /* Auto-Date Sync Logic */
  const syncDateFromPost = async (url) => {
    // Basic check if it looks like a post URL
    if (!url.includes('view') && !url.includes('/board/') && !url.includes('no=')) return;

    // Determine if it might be a post (has 'no=' or is a view path)
    const isPost = url.includes('no=') || (url.includes('/board/') && !url.includes('/lists') && /\/board\/[^/]+\/\d+/.test(url));
    if (!isPost) return;

    setIsSyncingDate(true);
    setSyncMessage('🕒 Checking post date...');

    try {
      const res = await fetch(`/api/peek_post?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.timestamp) {
          const date = new Date(data.timestamp);
          setScrapeTime(date);
          setSyncMessage(`✅ Time Set! Adjust wheels below to fine-tune.`);
          setTimeout(() => setSyncMessage(''), 4000);
        }
      } else {
        setSyncMessage('');
      }
    } catch (e) {
      console.error(e);
      setSyncMessage('');
    } finally {
      setIsSyncingDate(false);
    }
  };

  const handleUrlBlur = () => {
    if (scrapeUrl) {
      syncDateFromPost(scrapeUrl);
    }
  };

  const handleSendMessage = async (e) => {
    if ((e.key === 'Enter' || e.type === 'click') && chatInput.trim()) {
      if (!replayTime) return;

      const userMsgContent = chatInput.trim();
      const currentTs = replayTime.getTime();

      const newPost = {
        title: userMsgContent,
        author: '나',
        timestamp: new Date().toISOString(),
        virtualTimestamp: currentTs,
        displayTime: formatTime(replayTime),
        isUser: true
      };

      // 1. Show User Message immediately
      setDisplayedPosts((prev) => [...prev, newPost]);

      // Update main posts array to include user message (for seek/heatmap consistency)
      setPosts((prev) => {
        const newPosts = [...prev, newPost];
        return newPosts.sort((a, b) => a.virtualTimestamp - b.virtualTimestamp);
      });

      setChatInput('');
      setCurrentPostIndex((prev) => prev + 1);

      // --- AI Reaction Logic ---

      // Collect Context (Last 10 messages visible)
      const context = displayedPosts.slice(-10).map(p => ({
        author: p.author,
        title: p.title
      }));

      // Call API
      try {
        const res = await fetch('/api/generate_reaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-api-key': apiKey // Send key if exists
          },
          body: JSON.stringify({
            context,
            userMessage: userMsgContent
          })
        });

        if (!res.ok) {
          // If 401, maybe prompt settings?
          if (res.status === 401) {
            console.warn("API Key missing or invalid");
            // Optional: Alert user or show small toast
          }
          return;
        }

        const data = await res.json();

        if (data.reactions && Array.isArray(data.reactions)) {
          // Schedule reactions
          data.reactions.forEach((reactionText) => {
            // Random delay 1s ~ 3s
            const delay = 1000 + Math.random() * 2000;
            const reactionTs = currentTs + delay;

            setTimeout(() => {
              const reactionPost = {
                title: reactionText,
                author: 'ㅇㅇ', // Anonymous
                timestamp: new Date().toISOString(), // Valid format needed?
                virtualTimestamp: reactionTs,
                displayTime: formatTime(new Date(reactionTs)),
                isUser: false,
                ip: 'AI' // Mark as AI for debugging?
              };

              // Add to Real-time View
              setDisplayedPosts((prev) => {
                // Only add if we are still playing/watching nearby code? 
                // Simpler: Just append. 
                return [...prev, reactionPost];
              });

              // Also add to main posts history so it persists if we rewind
              setPosts((prev) => {
                const newPosts = [...prev, reactionPost];
                return newPosts.sort((a, b) => a.virtualTimestamp - b.virtualTimestamp);
              });

            }, delay);
          });
        }
      } catch (err) {
        console.error("AI Generation failed", err);
      }
    }
  };

  const saveSettings = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    setShowSettings(false);
    alert('API Key Saved!');
  };

  const progressPercentage = startTime && endTime && replayTime
    ? ((replayTime.getTime() - startTime.getTime()) / (endTime.getTime() - startTime.getTime())) * 100
    : 0;

  return (
    <div className={styles.container} data-theme={theme}>
      <Head>
        <title>DC Replay Chat</title>
        <meta name="description" content="Replay DC Inside reactions" />
      </Head>

      <main>
        {posts.length === 0 ? (
          <div className={styles.landingContainer}>
            {/* Tab Switcher */}
            <div className={styles.tabContainer}>
              <button
                className={`${styles.tabButton} ${mode === 'upload' ? styles.activeTab : ''}`}
                onClick={() => setMode('upload')}
              >
                File Upload
              </button>
              <button
                className={`${styles.tabButton} ${mode === 'scrape' ? styles.activeTab : ''}`}
                onClick={() => setMode('scrape')}
              >
                Auto Scrape
              </button>
            </div>

            {mode === 'upload' ? (
              <label className={styles.uploadZone}>
                <input type="file" onChange={handleFileUpload} accept=".html" style={{ display: 'none' }} />
                <div style={{ textAlign: 'center' }}>
                  <h3>Drop DC Gallery HTML File Here</h3>
                  <p>Right click "Save As" on the list page, then upload.</p>
                </div>
              </label>
            ) : (
              <div className={styles.scrapeForm}>
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder="갤러리 주소 또는 게시글 주소 (자동 시간 설정)"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                />
                {syncMessage && <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginTop: '-0.5rem', paddingLeft: '0.5rem' }}>{syncMessage}</div>}

                <div className={styles.labelRow}>
                  <span className={styles.labelText} style={{ flex: 2 }}>시작 날짜 & 시간</span>
                  <span className={styles.labelText} style={{ flex: 1 }}>재생 구간</span>
                </div>

                <div className={styles.row}>
                  <div className={styles.datePickerWrapper}>
                    <DatePicker
                      locale="ko"
                      ref={datePickerRef}
                      selected={scrapeTime}
                      onChange={(date) => setScrapeTime(date)}
                      dateFormat="yyyy/MM/dd HH:mm"
                      showTimeInput
                      customTimeInput={<CustomTimeInput />}
                      className={styles.inputField}
                      calendarClassName={styles.customCalendar}
                      popperClassName={styles.customPopper}
                      placeholderText="Select Date & Time"
                      shouldCloseOnSelect={false} // Keep open to let user click OK
                    >
                      <div className={styles.datePickerFooter}>
                        <button
                          className={styles.okButton}
                          onClick={(e) => {
                            e.preventDefault();
                            datePickerRef.current.setOpen(false);
                          }}
                        >
                          OK
                        </button>
                      </div>
                    </DatePicker>
                  </div>
                  <div className={styles.durationWrapper}>
                    <select
                      className={styles.inputField}
                      value={scrapeDuration}
                      onChange={(e) => setScrapeDuration(Number(e.target.value))}
                    >
                      <option value={30}>30 Mins</option>
                      <option value={60}>1 Hour</option>
                      <option value={120}>2 Hours</option>
                      <option value={180}>3 Hours</option>
                      <option value={360}>6 Hours (Slow)</option>
                      <option value={720}>12 Hours (Risk)</option>
                    </select>
                  </div>
                </div>

                {scrapeDuration >= 360 && (
                  <div style={{ color: '#fbbf24', fontSize: '0.8rem', marginTop: '-0.5rem' }}>
                    ⚠️ Long durations on active galleries may take 5-10 mins to scrape.
                  </div>
                )}

                <button
                  className={styles.scrapeButton}
                  onClick={handleScrape}
                  disabled={isScraping}
                >
                  {isScraping ? 'Searching & Scraping...' : 'Start Replay'}
                </button>

                {isScraping && <div className={styles.loadingText}>Searching backwards for your date...</div>}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.chatContainer}>
            <div className={styles.header}>
              <span className={styles.headerTitle}>Live Reactions</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className={styles.timeDisplay}>{formatTime(replayTime)}</div>
                <button
                  className={styles.iconButton}
                  onClick={toggleTheme}
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? '🌙' : '☀️'}
                </button>
                <button
                  className={styles.iconButton}
                  onClick={() => setShowSettings(true)}
                  title="Settings (API Key)"
                >
                  ⚙️
                </button>
              </div>
            </div>

            <div className={styles.messagesArea}>
              {/* VIRTUALIZATION / SAFETY LIMIT: Only render last 300 messages to prevent DOM Overflow/Lag */}
              {displayedPosts.slice(-300).map((msg, i) => (
                <div key={i} className={`${styles.messageBubble} ${msg.isUser ? styles.myMessage : ''}`}>
                  <div className={styles.metaRow}>
                    <span className={styles.author}>{msg.author}</span>
                    <span className={styles.ip}>
                      {msg.ip ? `(${msg.ip})` : msg.uid ? '' : ''}
                    </span>
                    <span className={styles.time}>{msg.displayTime}</span>
                  </div>
                  <div className={styles.content} style={{ fontSize: `${fontSize}px` }}>{msg.title}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.chatInputArea}>
              <input
                type="text"
                className={styles.chatInput}
                placeholder="채팅 치기..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleSendMessage}
              />
              <button className={styles.sendButton} onClick={handleSendMessage}>전송</button>
            </div>

            <div className={styles.controlsArea}>

              {/* Heatmap Toggle & Label */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.2rem', gap: '1rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                  />
                  Show Heatmap
                </label>
              </div>

              {/* Progress Bar (Scrubber) */}
              <div
                className={styles.progressBar}
                onClick={handleSeek}
                ref={progressBarRef}
                title="Click to seek"
              >
                {/* Heatmap Overlay */}
                {showHeatmap && (
                  <div className={styles.heatmapContainer}>
                    {heatmap.map((bin, i) => (
                      <div
                        key={i}
                        className={styles.heatmapBar}
                        style={{
                          height: `${bin.height}%`,
                          opacity: 0.5 + (bin.height / 200)
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className={styles.progressFill} style={{ width: `${progressPercentage}%` }}></div>
              </div>

              {/* Control Buttons */}
              <div className={styles.controlRow}>
                <div className={styles.leftControls}>
                  <select
                    className={styles.speedSelect}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  >
                    <option value={1}>1.0x</option>
                    <option value={2}>2.0x</option>
                    <option value={5}>5.0x</option>
                    <option value={10}>10.0x</option>
                  </select>
                </div>

                <div className={styles.centerControls}>
                  <button className={styles.iconButton} onClick={() => handleJump(-10)}>-10s</button>
                  <button className={styles.tinyButton} onClick={() => handleJump(-1)}>-1s</button>
                  <button className={styles.tinyButton} onClick={() => handleJump(-0.5)}>-0.5s</button>

                  <button className={styles.playButton} onClick={togglePlay}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>

                  <button className={styles.tinyButton} onClick={() => handleJump(0.5)}>+0.5s</button>
                  <button className={styles.tinyButton} onClick={() => handleJump(1)}>+1s</button>
                  <button className={styles.iconButton} onClick={() => handleJump(10)}>+10s</button>
                </div>

                <div className={styles.rightControls}>
                  <input
                    type="text"
                    className={styles.timeInput}
                    placeholder="HH:MM:SS"
                    value={timeInputValue}
                    onChange={handleTimeInputChange}
                    onKeyDown={handleTimeInput}
                  />

                  {/* Font Controls */}
                  <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px' }}>
                    <button
                      className={styles.iconButton}
                      onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                      style={{ fontSize: '0.8rem', width: '24px', height: '24px', padding: 0 }}
                      title="Decrease Font"
                    >
                      -
                    </button>
                    <span style={{ fontSize: '0.8rem', padding: '0 4px', lineHeight: '24px', color: '#ccc' }}>Aa</span>
                    <button
                      className={styles.iconButton}
                      onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                      style={{ fontSize: '0.8rem', width: '24px', height: '24px', padding: 0 }}
                      title="Increase Font"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Settings</h3>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#ccc' }}>
              Gemini API Key (Optional)
            </label>
            <input
              type="password"
              className={styles.inputField}
              style={{ width: '100%', marginBottom: '1rem' }}
              placeholder="Enter your API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Key is stored in your browser (LocalStorage).
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className={styles.tabButton}
                onClick={() => setShowSettings(false)}
                style={{ background: 'transparent', border: '1px solid #334155' }}
              >
                Cancel
              </button>
              <button
                className={styles.scrapeButton}
                onClick={saveSettings}
                style={{ marginTop: 0, padding: '0.5rem 1rem' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

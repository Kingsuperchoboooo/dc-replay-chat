
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';

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
  const [scrapeTime, setScrapeTime] = useState('');

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
  const [scrapeDuration, setScrapeDuration] = useState(60);
  const [isScraping, setIsScraping] = useState(false);

  // UI State
  const [fontSize, setFontSize] = useState(16);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const messagesEndRef = useRef(null);
  const timerRef = useRef(null);
  const progressBarRef = useRef(null);

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
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(scrapeUrl)}&targetTime=${scrapeTime}&duration=${scrapeDuration}`);
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

  const handleTimeInput = (e) => {
    if (e.key === 'Enter') {
      const input = e.target.value; // HH:MM:SS
      if (!startTime) return;

      const [h, m, s] = input.split(':').map(Number);
      if (isNaN(h) || isNaN(m) || isNaN(s)) return;

      const newDate = new Date(startTime);
      newDate.setHours(h);
      newDate.setMinutes(m);
      newDate.setSeconds(s);

      setReplayTime(newDate);
      e.target.value = ''; // Clear input
    }
  };

  const progressPercentage = startTime && endTime && replayTime
    ? ((replayTime.getTime() - startTime.getTime()) / (endTime.getTime() - startTime.getTime())) * 100
    : 0;

  return (
    <div className={styles.container}>
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
                  placeholder="Gallery URL (e.g. https://gall.dcinside.com/...)"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                />

                <div className={styles.labelRow}>
                  <span className={styles.labelText}>Target Date & Time</span>
                  <span className={styles.labelText}>Replay Duration</span>
                </div>

                <div className={styles.row}>
                  <input
                    type="datetime-local"
                    className={styles.inputField}
                    value={scrapeTime}
                    onChange={(e) => setScrapeTime(e.target.value)}
                  />
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
              <div className={styles.timeDisplay}>{formatTime(replayTime)}</div>
            </div>

            <div className={styles.messagesArea}>
              {displayedPosts.map((msg, i) => (
                <div key={i} className={styles.messageBubble}>
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
                  <button className={styles.iconButton} onClick={() => handleJump(-10)}>-10</button>
                  <button className={styles.playButton} onClick={togglePlay}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button className={styles.iconButton} onClick={() => handleJump(10)}>+10</button>
                </div>

                <div className={styles.rightControls}>
                  <input
                    type="text"
                    className={styles.timeInput}
                    placeholder="HH:MM:SS"
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
    </div>
  );
}

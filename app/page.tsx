"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CalendarBlank,
  CaretDown,
  Check,
  Clock,
  FileArrowUp,
  FileText,
  Lightbulb,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { ChangeEvent, DragEvent, useMemo, useState } from "react";

type View = "home" | "overview" | "review";
type ComposerMode = "capture" | "search";
type CardKind = "学习" | "分享" | "生活";

type MemoryCard = {
  id: number;
  title: string;
  excerpt: string;
  kind: CardKind;
  date: string;
  tone: string;
  tags: string[];
  question?: string;
  answer?: string;
  hint?: string;
};

const starterCards: MemoryCard[] = [
  {
    id: 1,
    title: "如何建立自己的复盘节奏",
    excerpt: "把每次输入变成一张可回看的卡片，慢慢形成自己的知识线索。",
    kind: "学习",
    date: "09.20",
    tone: "blue",
    tags: ["学习方法", "复盘"],
    question: "复盘的第一步应该做什么？",
    answer: "先记录事实：发生了什么、自己的反应是什么，再从中提取可改进的一点。",
    hint: "先分开“事实”和“评价”。",
  },
  {
    id: 2,
    title: "秋日公园的散步路线",
    excerpt: "风吹过湖面的下午，散步不是赶路，是给生活留下一个缓慢的空格。",
    kind: "生活",
    date: "09.19",
    tone: "apricot",
    tags: ["生活", "风景"],
  },
  {
    id: 3,
    title: "网页文章：输入到输出",
    excerpt: "一篇长文章不必一次记住，把重要观点拆成短小的问题和答案会更轻松。",
    kind: "学习",
    date: "09.18",
    tone: "mint",
    tags: ["阅读", "知识管理"],
    question: "为什么要把长文章拆成问题？",
    answer: "问题会逼迫我们提取重点，也让之后的回忆练习更有明确方向。",
    hint: "想想“主动回忆”比反复阅读多了什么。",
  },
  {
    id: 4,
    title: "想分享的一段话",
    excerpt: "认真生活的人，总会在平常日子里收集到一点自己的光。",
    kind: "分享",
    date: "09.17",
    tone: "lilac",
    tags: ["摘录", "分享"],
  },
];

const calendarDays = Array.from({ length: 30 }, (_, index) => index + 1);

function validUsername(value: string) {
  return /^(?=.*[A-Za-z\u4e00-\u9fa5])[A-Za-z0-9\u4e00-\u9fa5]{1,32}$/.test(
    value,
  );
}

function getCardKind(text: string): CardKind {
  if (/学习|课程|知识|笔记|题目|复习/.test(text)) return "学习";
  if (/旅行|风景|生活|日记|今天|散步/.test(text)) return "生活";
  return "分享";
}

function getCardTone(kind: CardKind) {
  if (kind === "学习") return "blue";
  if (kind === "生活") return "apricot";
  return "mint";
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [composerMode, setComposerMode] = useState<ComposerMode>("capture");
  const [content, setContent] = useState("");
  const [searchWord, setSearchWord] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [cards, setCards] = useState<MemoryCard[]>(starterCards);
  const [notice, setNotice] = useState("");
  const [selectedDate, setSelectedDate] = useState(20);
  const [selectedBook, setSelectedBook] = useState<CardKind>("学习");
  const [selectedSearchCard, setSelectedSearchCard] = useState<number | null>(
    null,
  );
  const [revealedCards, setRevealedCards] = useState<number[]>([]);
  const [hintCards, setHintCards] = useState<number[]>([]);
  const [reviewLevel, setReviewLevel] = useState("轻松复习");
  const [reviewedCards, setReviewedCards] = useState<number[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [signedInName, setSignedInName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authForm, setAuthForm] = useState({
    inviteAccount: "",
    password: "",
  });

  const resultCards = useMemo(() => {
    const keyword = searchWord.trim().toLowerCase();
    if (!keyword) return [];
    return cards.filter((card) =>
      [card.title, card.excerpt, card.kind, card.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [cards, searchWord]);

  const studyCards = cards.filter((card) => card.kind === "学习");
  const shownCards = cards.filter((card) => {
    if (selectedBook === "学习") return card.kind === "学习";
    if (selectedBook === "分享") return card.kind === "分享";
    return card.kind === "生活";
  });

  function openAuth() {
    setAuthError("");
    setAuthOpen(true);
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files || []).map(
      (file) => file.name,
    );
    setFiles((current) => current.concat(nextFiles).slice(0, 5));
  }

  function receiveDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const nextFiles = Array.from(event.dataTransfer.files).map(
      (file) => file.name,
    );
    setFiles((current) => current.concat(nextFiles).slice(0, 5));
  }

  function submitCapture() {
    if (!signedInName) {
      openAuth();
      return;
    }
    if (!content.trim() && files.length === 0) {
      setNotice("先写下一段内容，或放入一个文件再收录吧。");
      return;
    }
    const source = content.trim() || files[0];
    const kind = getCardKind(source);
    const newCard: MemoryCard = {
      id: Date.now(),
      title: source.slice(0, 24) + (source.length > 24 ? "…" : ""),
      excerpt:
        source.length > 76
          ? source.slice(0, 76) + "…"
          : source || "已收下这份新的内容，等你回来继续整理。",
      kind,
      date: "09.20",
      tone: getCardTone(kind),
      tags: kind === "学习" ? ["新收录", "待复习"] : ["新收录", kind],
      question:
        kind === "学习" ? "这张卡片里最值得记住的一点是什么？" : undefined,
      answer:
        kind === "学习"
          ? "试着用自己的话说出一个关键观点，并在下一次复习时补充细节。"
          : undefined,
      hint: kind === "学习" ? "从你最想保存的那句话开始。" : undefined,
    };
    setCards((current) => [newCard, ...current]);
    setContent("");
    setFiles([]);
    setNotice("收录好了。你可以在总览里把它继续整理成喜欢的样子。");
  }

  function submitSearch() {
    setSelectedSearchCard(null);
    if (!searchWord.trim()) {
      setNotice("写一个关键词，或描述一下你想找回的内容。");
      return;
    }
    setNotice(
      resultCards.length
        ? "翻到这些可能的卡片了，挑一张看看吧。"
        : "还没翻到匹配的内容，试试描述得更具体一点。",
    );
  }

  function validateAuth() {
    if (!validUsername(authForm.inviteAccount)) {
      setAuthError("请输入管理员提供的受邀账号。");
      return;
    }
    if (!/^[A-Za-z0-9]{8,32}$/.test(authForm.password)) {
      setAuthError("密码需为 8–32 位字母或数字。");
      return;
    }
    setSignedInName(authForm.inviteAccount);
    setAuthOpen(false);
    setAuthError("");
    setNotice("欢迎回来，今天想收录一点什么？");
  }

  function renderHome() {
    return (
      <main className="page-main home-main">
        <section className="date-ribbon" aria-label="今天的日期">
          <span>2026</span>
          <strong>09</strong>
          <span>20 · 周日</span>
        </section>

        <section className="home-intro">
          <p className="section-kicker">COLLECT THE EVERYDAY</p>
          <h1>把生活与知识，<br />折进自己的时间册</h1>
          <p>
            一段文字、一张图片、一篇文章，都会在这里慢慢长成
            <br className="desktop-only" />方便回看的小卡片。
          </p>
          <div className="intro-stats" aria-label="今日概览">
            <span><Sparkle size={17} weight="fill" /> 今日收录 3 条</span>
            <span><Clock size={17} weight="bold" /> 待复习 2 张</span>
          </div>
        </section>

        <section className="composer-paper" aria-label="内容收录和搜索">
          <div className="paper-fold" aria-hidden="true" />
          <div className="composer-tabs" role="tablist" aria-label="输入功能">
            <button
              className={composerMode === "capture" ? "tab is-active" : "tab"}
              onClick={() => setComposerMode("capture")}
              role="tab"
              aria-selected={composerMode === "capture"}
            >
              <FileText size={18} weight="bold" /> 收录
            </button>
            <button
              className={composerMode === "search" ? "tab is-active" : "tab"}
              onClick={() => setComposerMode("search")}
              role="tab"
              aria-selected={composerMode === "search"}
            >
              <MagnifyingGlass size={18} weight="bold" /> 搜索
            </button>
          </div>

          {composerMode === "capture" ? (
            <div className="composer-content">
              <label className="visually-hidden" htmlFor="capture-content">
                想收录的内容
              </label>
              <textarea
                id="capture-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="写下想留下的内容，也可以粘贴一个公开网页链接…"
              />
              <div className="composer-bottom">
                <label
                  className="file-spot"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={receiveDrop}
                  htmlFor="file-upload"
                >
                  <FileArrowUp size={18} weight="bold" />
                  <span>放入文件、图片或音视频</span>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.jpg,.jpeg,.png,.webp,.gif,.mp3,.wav,.m4a,.mp4,.mov"
                    onChange={addFiles}
                  />
                </label>
                <button className="primary-button" onClick={submitCapture}>
                  收进时间册 <PaperPlaneTilt size={18} weight="fill" />
                </button>
              </div>
              {files.length > 0 ? (
                <div className="file-list" aria-label="准备收录的文件">
                  {files.map((file) => (
                    <span className="file-chip" key={file}>
                      {file}
                      <button
                        aria-label={"移除 " + file}
                        onClick={() =>
                          setFiles((current) =>
                            current.filter((item) => item !== file),
                          )
                        }
                      >
                        <X size={14} weight="bold" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="composer-content search-content">
              <label className="visually-hidden" htmlFor="search-content">
                搜索卡片
              </label>
              <div className="search-field">
                <MagnifyingGlass size={23} weight="bold" />
                <input
                  id="search-content"
                  value={searchWord}
                  onChange={(event) => setSearchWord(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitSearch();
                  }}
                  placeholder="比如：上次看到的复盘方法、秋天的散步…"
                />
              </div>
              <button className="primary-button search-button" onClick={submitSearch}>
                打开时间册 <BookOpenText size={18} weight="fill" />
              </button>
              {searchWord.trim() ? (
                <div className="search-book" aria-live="polite">
                  <div className="book-spine">我的时间册</div>
                  <div className="book-pages">
                    {resultCards.length ? (
                      resultCards.slice(0, 3).map((card, index) => (
                        <button
                          className={"flying-card tone-" + card.tone}
                          key={card.id}
                          onClick={() => setSelectedSearchCard(card.id)}
                          style={{ zIndex: 3 - index }}
                        >
                          <small>{card.kind} · {card.date}</small>
                          <strong>{card.title}</strong>
                          <span>{card.excerpt}</span>
                        </button>
                      ))
                    ) : (
                      <p>书页安静地翻了一会儿，<br />还没有找到对应的卡片。</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
          {notice ? <p className="composer-notice" aria-live="polite">{notice}</p> : null}
        </section>

        <section className="home-shelf" aria-label="最近收录">
          <div className="shelf-heading">
            <span className="hand-mark">✦</span>
            <div>
              <p>RECENT PIECES</p>
              <h2>最近收进来的小片段</h2>
            </div>
            <button className="text-button" onClick={() => setView("overview")}>
              查看全部 <ArrowRight size={16} weight="bold" />
            </button>
          </div>
          <div className="card-row">
            {cards.slice(0, 3).map((card) => (
              <button
                className={"mini-card tone-" + card.tone}
                key={card.id}
                onClick={() => {
                  setView(card.kind === "学习" ? "review" : "overview");
                  setSelectedBook(card.kind);
                }}
              >
                <small>{card.kind} · {card.date}</small>
                <strong>{card.title}</strong>
                <span>{card.excerpt}</span>
                <i>{card.tags[0]}</i>
              </button>
            ))}
          </div>
        </section>
        {selectedSearchCard ? (
          <div className="found-card-panel" role="status">
            <Check size={18} weight="bold" />
            已选中这张卡片，其他卡片已经回到时间册。
            <button onClick={() => setSelectedSearchCard(null)} aria-label="关闭提示">
              <X size={17} weight="bold" />
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  function renderOverview() {
    return (
      <main className="page-main overview-main">
        <section className="overview-heading">
          <div>
            <p className="section-kicker">YOUR TIME AT A GLANCE</p>
            <h1>翻开这一页，<br />看看你走过的痕迹</h1>
          </div>
          <p>点亮的日期，藏着你曾经认真留下的内容。</p>
        </section>

        <section className="overview-layout">
          <aside className="calendar-paper" aria-label="收录日期">
            <div className="calendar-top">
              <span>2026 年</span>
              <strong>九月</strong>
              <button aria-label="选择月份"><CaretDown size={18} weight="bold" /></button>
            </div>
            <div className="week-labels" aria-hidden="true">
              <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
            </div>
            <div className="calendar-grid">
              {calendarDays.map((day) => {
                const lit = [12, 17, 18, 19, 20].includes(day);
                const selected = selectedDate === day;
                return (
                  <button
                    className={
                      selected
                        ? "calendar-day is-selected"
                        : lit
                          ? "calendar-day is-lit"
                          : "calendar-day"
                    }
                    key={day}
                    onClick={() => setSelectedDate(day)}
                    aria-label={"9月" + day + "日" + (lit ? "有收录" : "")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="calendar-note"><span /> 有收录的日子</div>
          </aside>

          <section className="book-area" aria-label="按主题查看时间册">
            <div className="book-switcher">
              <button
                className={selectedBook === "学习" ? "book-tab is-selected" : "book-tab"}
                onClick={() => setSelectedBook("学习")}
              >
                <BookOpenText size={22} weight="fill" /> 学习册
              </button>
              <button
                className={selectedBook === "分享" ? "book-tab is-selected mint-tab" : "book-tab mint-tab"}
                onClick={() => setSelectedBook("分享")}
              >
                <Sparkle size={22} weight="fill" /> 分享册
              </button>
              <button
                className={selectedBook === "生活" ? "book-tab is-selected apricot-tab" : "book-tab apricot-tab"}
                onClick={() => setSelectedBook("生活")}
              >
                <CalendarBlank size={22} weight="fill" /> 生活册
              </button>
            </div>
            <div className={"open-book book-" + getCardTone(selectedBook)}>
              <div className="book-page book-left">
                <p>FROM THIS DAY</p>
                <strong>9 月 {selectedDate} 日</strong>
                <span>从这天开始翻页</span>
                <div className="book-page-rule" />
                <small>你留下的内容，会在未来成为<br />可以再次照见自己的线索。</small>
              </div>
              <div className="book-page book-right">
                <p>{selectedBook}册 · 第 01 页</p>
                <h2>{selectedBook === "学习" ? "今天学到的，值得被慢慢记住。" : selectedBook === "生活" ? "日常的小事，也自有它的光。" : "想分享的心情，都有自己的位置。"}</h2>
                <span className="page-flower">✦</span>
                <button className="page-arrow left" aria-label="上一页"><ArrowLeft size={18} weight="bold" /></button>
                <button className="page-arrow right" aria-label="下一页"><ArrowRight size={18} weight="bold" /></button>
              </div>
            </div>
          </section>
        </section>

        <section className="collection-section">
          <div className="section-heading-line">
            <div>
              <p className="section-kicker">ON THIS PAGE</p>
              <h2>这一页收着的片段</h2>
            </div>
            <button className="text-button" onClick={() => setView("home")}>
              <Plus size={17} weight="bold" /> 再收录一条
            </button>
          </div>
          <div className="collection-grid">
            {shownCards.length ? shownCards.map((card) => (
              <article className={"collection-card tone-" + card.tone} key={card.id}>
                <div><small>{card.kind} · {card.date}</small><span>···</span></div>
                <h3>{card.title}</h3>
                <p>{card.excerpt}</p>
                <footer>{card.tags.map((tag) => <i key={tag}>#{tag}</i>)}</footer>
              </article>
            )) : (
              <div className="empty-page">这一册还空着，去首页放入第一份内容吧。</div>
            )}
          </div>
        </section>
      </main>
    );
  }

  function renderReview() {
    return (
      <main className="page-main review-main">
        <section className="review-heading">
          <div>
            <p className="section-kicker">REVIEW A LITTLE TODAY</p>
            <h1>今天，温柔地<br />复习一小会儿</h1>
          </div>
          <div className="review-level">
            <span>今日节奏</span>
            <button onClick={() => setReviewLevel(reviewLevel === "轻松复习" ? "深入回想" : "轻松复习")}>
              {reviewLevel} <CaretDown size={16} weight="bold" />
            </button>
          </div>
        </section>
        <section className="review-board">
          <aside className="review-aside">
            <span className="review-count">02</span>
            <strong>张待复习</strong>
            <p>不用赶路。<br />每记起一点，<br />都是新的连接。</p>
            <div className="pencil-mark">✦</div>
          </aside>
          <div className="question-stack">
            {studyCards.slice(0, 2).map((card, index) => {
              const revealed = revealedCards.includes(card.id);
              const hinted = hintCards.includes(card.id);
              const reviewed = reviewedCards.includes(card.id);
              return (
                <article className={reviewed ? "question-card is-reviewed" : "question-card"} key={card.id}>
                  <div className="question-meta">
                    <span>问题 0{index + 1}</span>
                    <small>{card.tags[0]}</small>
                  </div>
                  <h2>{card.question}</h2>
                  {hinted ? <p className="hint-box"><Lightbulb size={18} weight="fill" />{card.hint}</p> : null}
                  {revealed ? <div className="answer-box"><strong>答案</strong><p>{card.answer}</p></div> : null}
                  <div className="question-actions">
                    <button
                      className="hint-button"
                      onClick={() =>
                        setHintCards((current) =>
                          current.includes(card.id)
                            ? current.filter((id) => id !== card.id)
                            : current.concat(card.id),
                        )
                      }
                    >
                      <Lightbulb size={18} weight={hinted ? "fill" : "bold"} />
                      {hinted ? "收起提示" : "给我一点提示"}
                    </button>
                    <button
                      className="answer-button"
                      onClick={() =>
                        setRevealedCards((current) =>
                          current.includes(card.id)
                            ? current.filter((id) => id !== card.id)
                            : current.concat(card.id),
                        )
                      }
                    >
                      {revealed ? "收起答案" : "翻到答案面"} <ArrowRight size={17} weight="bold" />
                    </button>
                  </div>
                  {revealed ? (
                    <button
                      className="complete-button"
                      onClick={() =>
                        setReviewedCards((current) =>
                          current.includes(card.id) ? current : current.concat(card.id),
                        )
                      }
                    >
                      <Check size={18} weight="bold" />
                      {reviewed ? "已经记住啦" : "这张我记住啦"}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="timebook-app">
      <header className="site-header">
        <button className="brand" onClick={() => setView("home")} aria-label="回到首页">
          <span className="brand-sign">✦</span>
          <span>我的学习小站</span>
        </button>
        <nav aria-label="主导航">
          <button className={view === "home" ? "nav-link is-current" : "nav-link"} onClick={() => setView("home")}>首页</button>
          <button className={view === "overview" ? "nav-link is-current" : "nav-link"} onClick={() => setView("overview")}>总览</button>
          <button className={view === "review" ? "nav-link is-current" : "nav-link"} onClick={() => setView("review")}>复习</button>
        </nav>
        <div className="header-account">
          {signedInName ? (
            <button className="avatar-button" onClick={() => setSignedInName("")}>
              <span>{signedInName.slice(0, 1)}</span> 退出登录
            </button>
          ) : (
            <>
              <button className="login-button" onClick={openAuth}>受邀登录</button>
            </>
          )}
        </div>
      </header>

      {view === "home" ? renderHome() : view === "overview" ? renderOverview() : renderReview()}

      {authOpen ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setAuthOpen(false)}>
          <section
            className="auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="dialog-close" onClick={() => setAuthOpen(false)} aria-label="关闭">
              <X size={21} weight="bold" />
            </button>
            <p className="section-kicker">PRIVATE BETA</p>
            <h2 id="auth-title">受邀进入时间册</h2>
            <p className="auth-beta-note">这里目前只向受邀测试者开放。</p>
            <label>受邀账号
              <input maxLength={32} value={authForm.inviteAccount} onChange={(event) => setAuthForm({ ...authForm, inviteAccount: event.target.value.replace(/[^A-Za-z0-9\u4e00-\u9fa5]/g, "") })} placeholder="请输入管理员提供的账号" />
            </label>
            <label>访问密码
              <input type="password" maxLength={32} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value.replace(/[^A-Za-z0-9]/g, "") })} placeholder="8–32 位字母或数字" />
            </label>
            {authError ? <p className="auth-error" role="alert">{authError}</p> : null}
            <button className="auth-submit" onClick={validateAuth}>
              进入时间册
            </button>
            <p className="auth-guidance">还没有账号？请向管理员申请测试资格。</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

import type { DeskSource } from '@/lib/curator/desks'

/** Article feeds added to each group. BBC and Guardian are not in this list. */
export const ARTICLE_FEEDS: Record<string, DeskSource[]> = {
  "AI Research": [
    { kind: 'rss', name: "Import AI (Jack Clark)", ref: "https://importai.substack.com/feed" },
    { kind: 'rss', name: "Interconnects (Nathan Lambert)", ref: "https://www.interconnects.ai/feed" },
    { kind: 'rss', name: "Simon Willison", ref: "https://simonwillison.net/atom/everything/" },
    { kind: 'rss', name: "MIT Technology Review", ref: "https://www.technologyreview.com/feed/" },
  ],
  "Ancient Rome": [
    { kind: 'rss', name: "Arkeonews", ref: "https://arkeonews.net/feed/" },
    { kind: 'rss', name: "HeritageDaily", ref: "https://www.heritagedaily.com/feed" },
    { kind: 'rss', name: "Medievalists.net", ref: "https://www.medievalists.net/feed/" },
  ],
  "Babies": [
    { kind: 'rss', name: "ParentData (Emily Oster)", ref: "https://parentdata.org/feed/" },
  ],
  "Ballot Measures": [
    { kind: 'rss', name: "Ballotpedia", ref: "https://news.ballotpedia.org/feed/" },
    { kind: 'rss', name: "States Newsroom (40+ state outlets)", ref: "https://stateline.org/feed/" },
    { kind: 'rss', name: "Votebeat", ref: "https://www.votebeat.org/arc/outboundfeeds/rss/" },
  ],
  "Baseball": [
    { kind: 'rss', name: "FanGraphs", ref: "https://blogs.fangraphs.com/feed/" },
    { kind: 'rss', name: "ESPN RSS", ref: "https://www.espn.com/espn/rss/news" },
    { kind: 'rss', name: "Yahoo Sports RSS", ref: "https://sports.yahoo.com/rss/" },
  ],
  "Beauty": [
    { kind: 'rss', name: "Lab Muffin Beauty Science", ref: "https://labmuffin.com/feed/" },
  ],
  "Bills in Congress": [
    { kind: 'rss', name: "Common Dreams", ref: "https://www.commondreams.org/feeds/feed.rss" },
    { kind: 'rss', name: "Daily Caller", ref: "https://dailycaller.com/feed/" },
    { kind: 'rss', name: "The Dispatch", ref: "https://thedispatch.com/feed/" },
    { kind: 'rss', name: "The Federalist", ref: "https://thefederalist.com/feed/" },
  ],
  "Car Racing": [
    { kind: 'rss', name: "ESPN RSS", ref: "https://www.espn.com/espn/rss/news" },
    { kind: 'rss', name: "Motorsport.com", ref: "https://www.motorsport.com/rss/f1/news/" },
  ],
  "China, Korea, and Japan": [
    { kind: 'rss', name: "The Diplomat", ref: "https://thediplomat.com/feed/" },
    { kind: 'rss', name: "JSTOR Daily", ref: "https://daily.jstor.org/feed/" },
  ],
  "Church Councils": [
    { kind: 'rss', name: "Religion News Service", ref: "https://religionnews.com/feed/" },
    { kind: 'rss', name: "Vatican News", ref: "https://www.vaticannews.va/en.rss.xml" },
  ],
  "Cities": [
    { kind: 'rss', name: "Planetizen", ref: "https://www.planetizen.com/frontpage/feed" },
    { kind: 'rss', name: "Streetsblog USA", ref: "https://usa.streetsblog.org/feed" },
    { kind: 'rss', name: "Strong Towns", ref: "https://www.strongtowns.org/journal?format=rss" },
  ],
  "City Laws": [
    { kind: 'rss', name: "States Newsroom (40+ state outlets)", ref: "https://stateline.org/feed/" },
    { kind: 'rss', name: "Strong Towns", ref: "https://www.strongtowns.org/journal?format=rss" },
  ],
  "Climate and Energy": [
    { kind: 'rss', name: "Carbon Brief", ref: "https://www.carbonbrief.org/feed/" },
    { kind: 'rss', name: "Inside Climate News", ref: "https://insideclimatenews.org/feed/" },
    { kind: 'rss', name: "Climate Etc. (Judith Curry)", ref: "https://judithcurry.com/feed/" },
    { kind: 'rss', name: "The Honest Broker (Roger Pielke Jr.)", ref: "https://rogerpielkejr.substack.com/feed" },
  ],
  "College Basketball": [
    { kind: 'rss', name: "ESPN RSS", ref: "https://www.espn.com/espn/rss/news" },
    { kind: 'rss', name: "Yahoo Sports RSS", ref: "https://sports.yahoo.com/rss/" },
  ],
  "College Football": [
    { kind: 'rss', name: "ESPN RSS", ref: "https://www.espn.com/espn/rss/news" },
    { kind: 'rss', name: "Yahoo Sports RSS", ref: "https://sports.yahoo.com/rss/" },
  ],
  "Confucius, Laozi, and the Buddha": [
    { kind: 'rss', name: "Stanford Encyclopedia of Philosophy", ref: "https://plato.stanford.edu/rss/sep.xml" },
  ],
  "Congressional Hearings": [
    { kind: 'rss', name: "Politico", ref: "https://rss.politico.com/politics-news.xml" },
    { kind: 'rss', name: "Roll Call", ref: "https://rollcall.com/feed/" },
    { kind: 'rss', name: "The Hill", ref: "https://thehill.com/news/feed/" },
  ],
  "Courts and Statutes": [
    { kind: 'rss', name: "Above the Law", ref: "https://abovethelaw.com/feed/" },
    { kind: 'rss', name: "Courthouse News Service", ref: "https://www.courthousenews.com/feed/" },
    { kind: 'rss', name: "The Marshall Project", ref: "https://www.themarshallproject.org/rss/recent.rss" },
    { kind: 'rss', name: "SCOTUSblog", ref: "https://www.scotusblog.com/feed/" },
  ],
  "Crypto Scams": [
    { kind: 'rss', name: "Citation Needed (Molly White)", ref: "https://www.citationneeded.news/rss/" },
    { kind: 'rss', name: "Decrypt", ref: "https://decrypt.co/feed" },
    { kind: 'rss', name: "Protos", ref: "https://protos.com/feed/" },
    { kind: 'rss', name: "Web3 Is Going Just Great (Molly White)", ref: "https://web3isgoinggreat.com/feed.xml" },
  ],
  "Declassified Files": [
    { kind: 'rss', name: "The Black Vault", ref: "https://www.theblackvault.com/documentarchive/feed/" },
    { kind: 'rss', name: "Consortium News", ref: "https://consortiumnews.com/feed/" },
    { kind: 'rss', name: "Glenn Greenwald", ref: "https://greenwald.substack.com/feed" },
    { kind: 'rss', name: "Seymour Hersh", ref: "https://seymourhersh.substack.com/feed" },
  ],
  "Digs and Artifacts": [
    { kind: 'rss', name: "Arkeonews", ref: "https://arkeonews.net/feed/" },
    { kind: 'rss', name: "Biblical Archaeology Society", ref: "https://www.biblicalarchaeology.org/feed/" },
    { kind: 'rss', name: "HeritageDaily", ref: "https://www.heritagedaily.com/feed" },
  ],
  "Early America": [
    { kind: 'rss', name: "Journal of the American Revolution", ref: "https://allthingsliberty.com/feed/" },
    { kind: 'rss', name: "National Archives blogs (Pieces of History, Text Message)", ref: "https://prologue.blogs.archives.gov/feed/" },
  ],
  "Early Christianity": [
    { kind: 'rss', name: "Biblical Archaeology Society", ref: "https://www.biblicalarchaeology.org/feed/" },
    { kind: 'rss', name: "Religion News Service", ref: "https://religionnews.com/feed/" },
  ],
  "Everything Else": [
    { kind: 'rss', name: "Aeon", ref: "https://aeon.co/feed.rss" },
    { kind: 'rss', name: "Quanta Magazine", ref: "https://www.quantamagazine.org/feed/" },
    { kind: 'rss', name: "JSTOR Daily", ref: "https://daily.jstor.org/feed/" },
    { kind: 'rss', name: "Public Domain Review", ref: "https://publicdomainreview.org/rss.xml" },
  ],
  "Family Life": [
    { kind: 'rss', name: "ParentData (Emily Oster)", ref: "https://parentdata.org/feed/" },
    { kind: 'rss', name: "Institute for Family Studies", ref: "https://ifstudies.org/blog/feed" },
  ],
  "Fashion": [
    { kind: 'rss', name: "WWD", ref: "https://wwd.com/feed/" },
  ],
  "Federal Reserve Balance Sheet": [
    { kind: 'rss', name: "Wolf Street", ref: "https://wolfstreet.com/feed/" },
    { kind: 'rss', name: "Liberty Street Economics (NY Fed)", ref: "https://libertystreeteconomics.newyorkfed.org/feed/" },
  ],
  "Film and Art": [
    { kind: 'rss', name: "RogerEbert.com", ref: "https://www.rogerebert.com/feed" },
    { kind: 'rss', name: "Hyperallergic", ref: "https://hyperallergic.com/feed/" },
  ],
  "Freedom of Information": [
    { kind: 'rss', name: "American Oversight", ref: "https://www.americanoversight.org/feed" },
    { kind: 'rss', name: "The Black Vault", ref: "https://www.theblackvault.com/documentarchive/feed/" },
    { kind: 'rss', name: "Judicial Watch", ref: "https://www.judicialwatch.org/feed/" },
  ],
  "Golf": [
    { kind: 'rss', name: "ESPN RSS", ref: "https://www.espn.com/espn/rss/news" },
    { kind: 'rss', name: "Golf Digest", ref: "https://www.golfdigest.com/feed/rss" },
  ],
  "Hidden Fees": [
    { kind: 'rss', name: "The Lever", ref: "https://www.levernews.com/rss/" },
    { kind: 'rss', name: "ProPublica", ref: "https://www.propublica.org/feeds/propublica/main" },
    { kind: 'rss', name: "FTC press releases", ref: "https://www.ftc.gov/feeds/press-release.xml" },
  ],
  "Hidden Lines in Big Bills": [
    { kind: 'rss', name: "The Lever", ref: "https://www.levernews.com/rss/" },
    { kind: 'rss', name: "Sludge", ref: "https://readsludge.com/feed/" },
    { kind: 'rss', name: "EveryCRSReport", ref: "https://www.everycrsreport.com/rss.xml" },
  ],
  "History in Their Own Words": [
    { kind: 'rss', name: "History Today", ref: "https://www.historytoday.com/feed/rss.xml" },
    { kind: 'rss', name: "JSTOR Daily", ref: "https://daily.jstor.org/feed/" },
    { kind: 'rss', name: "Public Domain Review", ref: "https://publicdomainreview.org/rss.xml" },
    { kind: 'rss', name: "National Archives blogs (Pieces of History, Text Message)", ref: "https://prologue.blogs.archives.gov/feed/" },
  ],
  "How Babies Grow": [
    { kind: 'rss', name: "ParentData (Emily Oster)", ref: "https://parentdata.org/feed/" },
  ],
  "How Congress Voted": [
    { kind: 'rss', name: "Politico", ref: "https://rss.politico.com/politics-news.xml" },
    { kind: 'rss', name: "Roll Call", ref: "https://rollcall.com/feed/" },
  ],
  "How Elections Are Run": [
    { kind: 'rss', name: "Ballotpedia", ref: "https://news.ballotpedia.org/feed/" },
    { kind: 'rss', name: "Democracy Docket", ref: "https://www.democracydocket.com/feed/" },
    { kind: 'rss', name: "States Newsroom (40+ state outlets)", ref: "https://stateline.org/feed/" },
    { kind: 'rss', name: "Votebeat", ref: "https://www.votebeat.org/arc/outboundfeeds/rss/" },
  ],
  "How Israel Started": [
    { kind: 'rss', name: "Jewish Currents", ref: "https://jewishcurrents.org/feed" },
    { kind: 'rss', name: "Mosaic", ref: "https://mosaicmagazine.com/feed/" },
  ],
  "How News Photos Are Made": [
    { kind: 'rss', name: "FAIR (media criticism)", ref: "https://fair.org/feed/" },
    { kind: 'rss', name: "NewsBusters (media criticism)", ref: "https://www.newsbusters.org/blog/feed" },
    { kind: 'rss', name: "PetaPixel", ref: "https://petapixel.com/feed/" },
    { kind: 'rss', name: "Poynter", ref: "https://www.poynter.org/feed/" },
  ],
  "How the Bible Was Assembled": [
    { kind: 'rss', name: "Biblical Archaeology Society", ref: "https://www.biblicalarchaeology.org/feed/" },
  ],
  "How the Federal Reserve Started": [
    { kind: 'rss', name: "JSTOR Daily", ref: "https://daily.jstor.org/feed/" },
    { kind: 'rss', name: "Liberty Street Economics (NY Fed)", ref: "https://libertystreeteconomics.newyorkfed.org/feed/" },
  ],
  "Insurance Denials": [
    { kind: 'rss', name: "KFF Health News", ref: "https://kffhealthnews.org/feed/" },
    { kind: 'rss', name: "ProPublica", ref: "https://www.propublica.org/feeds/propublica/main" },
  ],
  "Israel and Palestine": [
    { kind: 'rss', name: "+972 Magazine", ref: "https://www.972mag.com/feed/" },
    { kind: 'rss', name: "JTA", ref: "https://www.jta.org/feed" },
    { kind: 'rss', name: "Jewish Insider", ref: "https://jewishinsider.com/feed/" },
    { kind: 'rss', name: "Times of Israel", ref: "https://www.timesofisrael.com/feed/" },
    { kind: 'rss', name: "Middle East Eye", ref: "https://www.middleeasteye.net/rss" },
    { kind: 'rss', name: "Responsible Statecraft (Quincy Institute)", ref: "https://responsiblestatecraft.org/feed/" },
  ],
  "Jewish History": [
    { kind: 'rss', name: "The Forward", ref: "https://forward.com/feed/" },
    { kind: 'rss', name: "Jewish Currents", ref: "https://jewishcurrents.org/feed" },
    { kind: 'rss', name: "JTA", ref: "https://www.jta.org/feed" },
    { kind: 'rss', name: "Tablet", ref: "https://www.tabletmag.com/feed" },
  ],
  "Jewish Texts": [
    { kind: 'rss', name: "The Forward", ref: "https://forward.com/feed/" },
    { kind: 'rss', name: "JTA", ref: "https://www.jta.org/feed" },
    { kind: 'rss', name: "Tablet", ref: "https://www.tabletmag.com/feed" },
  ],
  "Jobs and Pay": [
    { kind: 'rss', name: "Calculated Risk", ref: "https://www.calculatedriskblog.com/feeds/posts/default" },
    { kind: 'rss', name: "In These Times", ref: "https://inthesetimes.com/rss" },
    { kind: 'rss', name: "The American Prospect", ref: "https://prospect.org/api/rss/all.rss" },
  ],
  "Laws About Speech on Israel": [
    { kind: 'rss', name: "The Free Press", ref: "https://www.thefp.com/feed" },
    { kind: 'rss', name: "The Intercept", ref: "https://theintercept.com/feed/?rss" },
    { kind: 'rss', name: "Jewish Insider", ref: "https://jewishinsider.com/feed/" },
    { kind: 'rss', name: "JTA", ref: "https://www.jta.org/feed" },
  ],
  "Letters of the Founders": [
    { kind: 'rss', name: "Journal of the American Revolution", ref: "https://allthingsliberty.com/feed/" },
    { kind: 'rss', name: "National Archives blogs (Pieces of History, Text Message)", ref: "https://prologue.blogs.archives.gov/feed/" },
  ],
  "Maps and Diagrams": [
    { kind: 'rss', name: "NASA Earth Observatory image of the day", ref: "https://earthobservatory.nasa.gov/feeds/image-of-the-day.rss" },
    { kind: 'rss', name: "Visual Capitalist", ref: "https://www.visualcapitalist.com/feed/" },
  ],
  "Markets and Central Banks": [
    { kind: 'rss', name: "Calculated Risk", ref: "https://www.calculatedriskblog.com/feeds/posts/default" },
    { kind: 'rss', name: "Lyn Alden", ref: "https://www.lynalden.com/feed/" },
    { kind: 'rss', name: "Naked Capitalism", ref: "https://www.nakedcapitalism.com/feed" },
    { kind: 'rss', name: "Wolf Street", ref: "https://wolfstreet.com/feed/" },
  ],
  "Medical Research": [
    { kind: 'rss', name: "KFF Health News", ref: "https://kffhealthnews.org/feed/" },
    { kind: 'rss', name: "Retraction Watch", ref: "https://retractionwatch.com/feed/" },
    { kind: 'rss', name: "Sensible Medicine", ref: "https://www.sensible-med.com/feed" },
    { kind: 'rss', name: "The BMJ", ref: "https://www.bmj.com/rss/recent.xml" },
  ],
  "Mergers and Antitrust": [
    { kind: 'rss', name: "BIG by Matt Stoller", ref: "https://www.thebignewsletter.com/feed" },
    { kind: 'rss', name: "The Lever", ref: "https://www.levernews.com/rss/" },
    { kind: 'rss', name: "The American Prospect", ref: "https://prospect.org/api/rss/all.rss" },
    { kind: 'rss', name: "Reason", ref: "https://reason.com/feed/" },
  ],
  "Neanderthals": [
    { kind: 'rss', name: "HeritageDaily", ref: "https://www.heritagedaily.com/feed" },
    { kind: 'rss', name: "Quanta Magazine", ref: "https://www.quantamagazine.org/feed/" },
    { kind: 'rss', name: "EurekAlert! (AAAS)", ref: "https://www.eurekalert.org/rss.xml" },
    { kind: 'rss', name: "Science (AAAS) news", ref: "https://www.science.org/rss/news_current.xml" },
  ],
  "Old Photographs": [
    { kind: 'rss', name: "Public Domain Review", ref: "https://publicdomainreview.org/rss.xml" },
  ],
  "Open AI Models": [
    { kind: 'rss', name: "404 Media", ref: "https://www.404media.co/rss/" },
    { kind: 'rss', name: "Interconnects (Nathan Lambert)", ref: "https://www.interconnects.ai/feed" },
    { kind: 'rss', name: "SemiAnalysis", ref: "https://semianalysis.com/feed/" },
  ],
  "Open and Closed AI": [
    { kind: 'rss', name: "404 Media", ref: "https://www.404media.co/rss/" },
    { kind: 'rss', name: "Import AI (Jack Clark)", ref: "https://importai.substack.com/feed" },
    { kind: 'rss', name: "Interconnects (Nathan Lambert)", ref: "https://www.interconnects.ai/feed" },
    { kind: 'rss', name: "Simon Willison", ref: "https://simonwillison.net/atom/everything/" },
  ],
  "Persia After Islam": [
    { kind: 'rss', name: "JSTOR Daily", ref: "https://daily.jstor.org/feed/" },
  ],
  "Philosophy": [
    { kind: 'rss', name: "Aeon", ref: "https://aeon.co/feed.rss" },
    { kind: 'rss', name: "Daily Nous", ref: "https://dailynous.com/feed/" },
    { kind: 'rss', name: "Stanford Encyclopedia of Philosophy", ref: "https://plato.stanford.edu/rss/sep.xml" },
  ],
  "Product Recalls": [
    { kind: 'rss', name: "FDA recalls RSS", ref: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/recalls/rss.xml" },
  ],
  "Recipes": [
    { kind: 'rss', name: "Budget Bytes", ref: "https://www.budgetbytes.com/feed/" },
    { kind: 'rss', name: "Smitten Kitchen", ref: "https://smittenkitchen.com/feed/" },
  ],
  "Roman Empire": [
    { kind: 'rss', name: "Arkeonews", ref: "https://arkeonews.net/feed/" },
    { kind: 'rss', name: "HeritageDaily", ref: "https://www.heritagedaily.com/feed" },
  ],
  "Rules You Can Still Comment On": [
    { kind: 'rss', name: "The Lever", ref: "https://www.levernews.com/rss/" },
    { kind: 'rss', name: "The American Prospect", ref: "https://prospect.org/api/rss/all.rss" },
    { kind: 'rss', name: "Reason", ref: "https://reason.com/feed/" },
  ],
  "Science": [
    { kind: 'rss', name: "Quanta Magazine", ref: "https://www.quantamagazine.org/feed/" },
    { kind: 'rss', name: "Retraction Watch", ref: "https://retractionwatch.com/feed/" },
    { kind: 'rss', name: "Undark", ref: "https://undark.org/feed/" },
    { kind: 'rss', name: "EurekAlert! (AAAS)", ref: "https://www.eurekalert.org/rss.xml" },
  ],
  "Science in Baghdad": [
    { kind: 'rss', name: "JSTOR Daily", ref: "https://daily.jstor.org/feed/" },
  ],
  "Shipping Lanes": [
    { kind: 'rss', name: "gCaptain", ref: "https://gcaptain.com/feed/" },
    { kind: 'rss', name: "Hellenic Shipping News", ref: "https://www.hellenicshippingnews.com/feed/" },
    { kind: 'rss', name: "Splash247", ref: "https://splash247.com/feed/" },
    { kind: 'rss', name: "USNI News", ref: "https://news.usni.org/feed" },
  ],
  "Soccer, Tennis, Rugby, and Cricket": [
    { kind: 'rss', name: "ESPNcricinfo", ref: "https://www.espncricinfo.com/rss/content/story/feeds/0.xml" },
    { kind: 'rss', name: "ESPN RSS", ref: "https://www.espn.com/espn/rss/news" },
  ],
  "Stablecoins": [
    { kind: 'rss', name: "Citation Needed (Molly White)", ref: "https://www.citationneeded.news/rss/" },
    { kind: 'rss', name: "Decrypt", ref: "https://decrypt.co/feed" },
    { kind: 'rss', name: "Protos", ref: "https://protos.com/feed/" },
    { kind: 'rss', name: "Web3 Is Going Just Great (Molly White)", ref: "https://web3isgoinggreat.com/feed.xml" },
  ],
  "State Laws": [
    { kind: 'rss', name: "Ballotpedia", ref: "https://news.ballotpedia.org/feed/" },
    { kind: 'rss', name: "Stateline", ref: "https://stateline.org/feed/" },
    { kind: 'rss', name: "States Newsroom (40+ state outlets)", ref: "https://stateline.org/feed/" },
  ],
  "Strikes": [
    { kind: 'rss', name: "In These Times", ref: "https://inthesetimes.com/rss" },
    { kind: 'rss', name: "Jacobin", ref: "https://jacobin.com/feed/" },
    { kind: 'rss', name: "Payday Report", ref: "https://paydayreport.com/feed/" },
    { kind: 'rss', name: "The American Prospect", ref: "https://prospect.org/api/rss/all.rss" },
  ],
  "Summit Agreements": [
    { kind: 'rss', name: "PassBlue", ref: "https://www.passblue.com/feed/" },
    { kind: 'rss', name: "Kremlin (English)", ref: "http://en.kremlin.ru/events/president/news/feed" },
    { kind: 'rss', name: "White House briefings", ref: "https://www.whitehouse.gov/feed/" },
  ],
  "Technology": [
    { kind: 'rss', name: "404 Media", ref: "https://www.404media.co/rss/" },
    { kind: 'rss', name: "LWN.net", ref: "https://lwn.net/headlines/rss" },
    { kind: 'rss', name: "The Markup", ref: "https://themarkup.org/feeds/rss.xml" },
    { kind: 'rss', name: "Rest of World", ref: "https://restofworld.org/feed/latest" },
  ],
  "The Blockchain": [
    { kind: 'rss', name: "Citation Needed (Molly White)", ref: "https://www.citationneeded.news/rss/" },
    { kind: 'rss', name: "Decrypt", ref: "https://decrypt.co/feed" },
    { kind: 'rss', name: "Protos", ref: "https://protos.com/feed/" },
    { kind: 'rss', name: "Web3 Is Going Just Great (Molly White)", ref: "https://web3isgoinggreat.com/feed.xml" },
  ],
  "The Civil War and After": [
    { kind: 'rss', name: "Emerging Civil War", ref: "https://emergingcivilwar.com/feed/" },
  ],
  "The Congressional Record": [
    { kind: 'rss', name: "EveryCRSReport", ref: "https://www.everycrsreport.com/rss.xml" },
    { kind: 'rss', name: "Roll Call", ref: "https://rollcall.com/feed/" },
  ],
  "The Dead Sea Scrolls": [
    { kind: 'rss', name: "Arkeonews", ref: "https://arkeonews.net/feed/" },
    { kind: 'rss', name: "Biblical Archaeology Society", ref: "https://www.biblicalarchaeology.org/feed/" },
  ],
  "The Enlightenment": [
    { kind: 'rss', name: "Stanford Encyclopedia of Philosophy", ref: "https://plato.stanford.edu/rss/sep.xml" },
  ],
  "The First Humans": [
    { kind: 'rss', name: "Arkeonews", ref: "https://arkeonews.net/feed/" },
    { kind: 'rss', name: "HeritageDaily", ref: "https://www.heritagedaily.com/feed" },
    { kind: 'rss', name: "Quanta Magazine", ref: "https://www.quantamagazine.org/feed/" },
    { kind: 'rss', name: "Science (AAAS) news", ref: "https://www.science.org/rss/news_current.xml" },
  ],
  "The Gilded Age": [
    { kind: 'rss', name: "JSTOR Daily", ref: "https://daily.jstor.org/feed/" },
  ],
  "The History of China": [
    { kind: 'rss', name: "The Diplomat", ref: "https://thediplomat.com/feed/" },
    { kind: 'rss', name: "JSTOR Daily", ref: "https://daily.jstor.org/feed/" },
  ],
  "The History of Islam": [
    { kind: 'rss', name: "JSTOR Daily", ref: "https://daily.jstor.org/feed/" },
  ],
  "The History of Japan": [
    { kind: 'rss', name: "Japan Times", ref: "https://www.japantimes.co.jp/feed/" },
  ],
  "The History of Zionism": [
    { kind: 'rss', name: "The Forward", ref: "https://forward.com/feed/" },
    { kind: 'rss', name: "Jewish Currents", ref: "https://jewishcurrents.org/feed" },
    { kind: 'rss', name: "Mosaic", ref: "https://mosaicmagazine.com/feed/" },
    { kind: 'rss', name: "Tablet", ref: "https://www.tabletmag.com/feed" },
  ],
  "The Islamic Empires": [
    { kind: 'rss', name: "Medievalists.net", ref: "https://www.medievalists.net/feed/" },
    { kind: 'rss', name: "JSTOR Daily", ref: "https://daily.jstor.org/feed/" },
  ],
  "The Labor Movement": [
    { kind: 'rss', name: "In These Times", ref: "https://inthesetimes.com/rss" },
    { kind: 'rss', name: "Jacobin", ref: "https://jacobin.com/feed/" },
    { kind: 'rss', name: "Payday Report", ref: "https://paydayreport.com/feed/" },
    { kind: 'rss', name: "The American Prospect", ref: "https://prospect.org/api/rss/all.rss" },
  ],
  "The NBA": [
    { kind: 'rss', name: "ESPN RSS", ref: "https://www.espn.com/espn/rss/news" },
    { kind: 'rss', name: "Yahoo Sports RSS", ref: "https://sports.yahoo.com/rss/" },
  ],
  "The NFL": [
    { kind: 'rss', name: "ESPN RSS", ref: "https://www.espn.com/espn/rss/news" },
    { kind: 'rss', name: "Yahoo Sports RSS", ref: "https://sports.yahoo.com/rss/" },
  ],
  "The NHL": [
    { kind: 'rss', name: "ESPN RSS", ref: "https://www.espn.com/espn/rss/news" },
    { kind: 'rss', name: "Yahoo Sports RSS", ref: "https://sports.yahoo.com/rss/" },
  ],
  "The Roman Army": [
    { kind: 'rss', name: "Arkeonews", ref: "https://arkeonews.net/feed/" },
    { kind: 'rss', name: "HeritageDaily", ref: "https://www.heritagedaily.com/feed" },
  ],
  "The Soviet Union": [
    { kind: 'rss', name: "Meduza", ref: "https://meduza.io/rss/en/all" },
  ],
  "The Stoics": [
    { kind: 'rss', name: "Daily Stoic", ref: "https://dailystoic.com/feed/" },
    { kind: 'rss', name: "Stanford Encyclopedia of Philosophy", ref: "https://plato.stanford.edu/rss/sep.xml" },
  ],
  "Things to Do This Weekend": [
    { kind: 'rss', name: "Atlas Obscura", ref: "https://www.atlasobscura.com/feeds/latest" },
  ],
  "Tracing Your Family": [
    { kind: 'rss', name: "Eastman's Online Genealogy Newsletter", ref: "https://blog.eogn.com/feed/" },
  ],
  "Treaties": [
    { kind: 'rss', name: "PassBlue", ref: "https://www.passblue.com/feed/" },
    { kind: 'rss', name: "Kremlin (English)", ref: "http://en.kremlin.ru/events/president/news/feed" },
    { kind: 'rss', name: "EUR-Lex", ref: "https://eur-lex.europa.eu/EN/display-feed.html" },
  ],
  "U.S. Weapons and Aid": [
    { kind: 'rss', name: "Antiwar.com", ref: "https://www.antiwar.com/blog/feed/" },
    { kind: 'rss', name: "Drop Site News", ref: "https://www.dropsitenews.com/feed" },
    { kind: 'rss', name: "Ken Klippenstein", ref: "https://www.kenklippenstein.com/feed" },
    { kind: 'rss', name: "The American Conservative", ref: "https://www.theamericanconservative.com/feed/" },
  ],
  "United Nations Votes": [
    { kind: 'rss', name: "PassBlue", ref: "https://www.passblue.com/feed/" },
    { kind: 'rss', name: "Responsible Statecraft (Quincy Institute)", ref: "https://responsiblestatecraft.org/feed/" },
  ],
  "What Companies Got Caught Doing": [
    { kind: 'rss', name: "Corporate Crime Reporter", ref: "https://www.corporatecrimereporter.com/feed/" },
    { kind: 'rss', name: "Center for Public Integrity", ref: "https://publicintegrity.org/feed/" },
    { kind: 'rss', name: "ICIJ", ref: "https://www.icij.org/feed/" },
    { kind: 'rss', name: "The Lever", ref: "https://www.levernews.com/rss/" },
  ],
  "What Your Representative Did": [
    { kind: 'rss', name: "The Daily Wire", ref: "https://www.dailywire.com/feeds/rss.xml" },
    { kind: 'rss', name: "Democracy Now!", ref: "https://www.democracynow.org/democracynow.rss" },
    { kind: 'rss', name: "Truthout", ref: "https://truthout.org/feed/" },
  ],
  "Who Buys the Government Debt": [
    { kind: 'rss', name: "Calculated Risk", ref: "https://www.calculatedriskblog.com/feeds/posts/default" },
    { kind: 'rss', name: "Lyn Alden", ref: "https://www.lynalden.com/feed/" },
    { kind: 'rss', name: "Wolf Street", ref: "https://wolfstreet.com/feed/" },
  ],
  "Who Got Sanctioned": [
    { kind: 'rss', name: "Antiwar.com", ref: "https://www.antiwar.com/blog/feed/" },
    { kind: 'rss', name: "UK sanctions (OFSI)", ref: "https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation.atom" },
    { kind: 'rss', name: "EUR-Lex", ref: "https://eur-lex.europa.eu/EN/display-feed.html" },
  ],
  "Who Owns the Computer Chips": [
    { kind: 'rss', name: "Chips and Cheese", ref: "https://chipsandcheese.com/feed/" },
    { kind: 'rss', name: "SemiAnalysis", ref: "https://semianalysis.com/feed/" },
  ],
  "Who Owns the Wealth": [
    { kind: 'rss', name: "ICIJ", ref: "https://www.icij.org/feed/" },
    { kind: 'rss', name: "The American Prospect", ref: "https://prospect.org/api/rss/all.rss" },
  ],
  "Who Paid for the Vote": [
    { kind: 'rss', name: "Washington Free Beacon", ref: "https://freebeacon.com/feed/" },
    { kind: 'rss', name: "The Lever", ref: "https://www.levernews.com/rss/" },
    { kind: 'rss', name: "OpenSecrets News", ref: "https://www.opensecrets.org/news/feed/" },
    { kind: 'rss', name: "Sludge", ref: "https://readsludge.com/feed/" },
  ],
  "Who Paid the Lobbyists": [
    { kind: 'rss', name: "Washington Free Beacon", ref: "https://freebeacon.com/feed/" },
    { kind: 'rss', name: "Lee Fang", ref: "https://www.leefang.com/feed" },
    { kind: 'rss', name: "The Lever", ref: "https://www.levernews.com/rss/" },
    { kind: 'rss', name: "OpenSecrets News", ref: "https://www.opensecrets.org/news/feed/" },
  ],
  "World News": [
    { kind: 'rss', name: "Kyiv Independent", ref: "https://kyivindependent.com/rss/" },
    { kind: 'rss', name: "Meduza", ref: "https://meduza.io/rss/en/all" },
    { kind: 'rss', name: "Daily Maverick (South Africa)", ref: "https://www.dailymaverick.co.za/dmrss/" },
    { kind: 'rss', name: "The Diplomat", ref: "https://thediplomat.com/feed/" },
    { kind: 'rss', name: "Bellingcat", ref: "https://www.bellingcat.com/feed/" },
    { kind: 'rss', name: "Global Voices", ref: "https://globalvoices.org/feed/" },
    { kind: 'rss', name: "MercoPress (South Atlantic / Latin America)", ref: "https://en.mercopress.com/rss" },
    { kind: 'rss', name: "Responsible Statecraft (Quincy Institute)", ref: "https://responsiblestatecraft.org/feed/" },
  ],
}

import type { Desk, DeskSource } from '@/lib/curator/desks'
import { deskSlug } from '@/lib/curator/slug'

function desk(id: string, name: string, bio: string, beat: string, sources: DeskSource[], focus?: string[], past = false): Desk {
  return {
    id,
    name,
    handle: `wire-${id}`,
    username: deskSlug(name),
    priorUsername: id,
    avatar: `/curator-avatars/${id}.jpg`,
    banner: `/curator-banners/${id}.svg`,
    bio,
    beat,
    focus,
    past,
    sources
  }
}

const yt = (name: string, ref: string): DeskSource => ({ kind: 'youtube', name, ref })
const rss = (name: string, ref: string): DeskSource => ({ kind: 'rss', name, ref })

export const ROSTER: Desk[] = [
  desk('treaty-text', 'Treaties', 'I post the treaty, the sanctions list, the communique, or the declassified file, in the words that were written.', 'The words written in a treaty or a sanctions list.', [
    rss('UN peace and security', 'https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml'),
    rss('State Department', 'https://www.state.gov/feed/')
  ]),
  desk('strait-watch', 'Shipping Lanes', 'I follow Hormuz, Suez, Malacca, the Taiwan Strait, and the pipelines, and who controls them.', 'Who controls Hormuz, Suez, Malacca, the Taiwan Strait, and the pipelines.', [
    rss('EIA Today in Energy', 'https://www.eia.gov/rss/todayinenergy.xml'),
    rss('IEA news', 'https://www.iea.org/news/rss')
  ]),
  desk('vera-ballot', 'How Elections Are Run', 'I post the rules, the count, and the administration. Not the horse race.', 'The rules, the count, and how an election is run.', [
    rss('FEC updates', 'https://www.fec.gov/updates/feed/')
  ]),
  desk('donor-trail', 'Who Paid for the Vote', 'I follow a dollar from donor to candidate to vote, and who was paid to lobby the bill.', 'A dollar from the donor to the candidate to the vote.', [
    rss('OpenSecrets', 'https://www.opensecrets.org/news/feed'),
    rss('House floor', 'https://www.congress.gov/rss/house-floor-today.xml')
  ]),
  desk('jekyll-island', 'How the Federal Reserve Started', 'I post how the Fed and its peers were built, and where a dollar actually comes from. Markets and Central Banks posts the weekly numbers.', 'How the Federal Reserve was built and where a dollar comes from.', [
    rss('Bank of England', 'https://www.bankofengland.co.uk/rss/news'),
    rss('BIS', 'https://www.bis.org/doclist/rss/bis_fsi_publs.rss')
  ]),
  desk('bill-watch', 'Bills in Congress', 'I post one bill that has its own vote: what it does, who sponsored it, and where it stands. A section buried in the NDAA or another must-pass bill belongs to Hidden Lines in Big Bills.', 'One bill: what it does, who sponsored it, and where it stands.', [
    rss('Congress most-viewed bills', 'https://www.congress.gov/rss/most-viewed-bills.xml'),
    rss('CBO', 'https://www.cbo.gov/publications/all/rss.xml')
  ]),
  desk('cole-wage', 'Jobs and Pay', 'I post what the labor series measured.', 'The official numbers on jobs and pay.', [
    rss('Bureau of Labor Statistics', 'https://www.bls.gov/feed/bls_latest.rss')
  ]),
  desk('picket-line', 'Strikes', 'I post a strike, a labor-history record, or a wage-theft or safety case.', 'A strike, or a wage and safety case.', [
    rss('Department of Labor', 'https://www.dol.gov/rss/newsreleases.xml'),
    rss('OSHA', 'https://www.osha.gov/rss/newsreleases.xml')
  ]),
  desk('roman-mile', 'Ancient Rome', 'I post the Republic in their own words, a frontier and the soldiers\' letters, or the coinage and who it enriched.', 'Rome, one subject at a time: the Republic, the army, or the coins.', [
    yt('Historia Civilis', 'HistoriaCivilis'),
    yt('Invicta', 'Invicta')
  ], undefined, true),
  desk('ming-brush', 'China, Korea, and Japan', 'Each post is one place. I rotate the Chinese official histories, the Joseon annals, and Japanese records through Meiji.', 'One place at a time in China, Korea, or Japan.', [
    yt('Voices of the Past', 'VoicesofthePast')
  ], ['shogun', 'samurai', 'meiji', 'joseon', 'ming dynasty', 'qing dynasty', 'tokugawa', 'edo period', 'goryeo'], true),
  desk('minute-book', 'City Laws', 'I post a city or state bill before the vote and what it would change, then a council vote, a rule still open for comment, a ballot measure, or a FOIA result.', 'A city or state bill before the vote, and what it would change.', [
    rss('Federal Register', 'https://www.federalregister.gov/documents/search.rss?conditions%5Btype%5D%5B%5D=RULE&conditions%5Btype%5D%5B%5D=PRORULE')
  ]),
  desk('olive-ledger', 'Israel and Palestine', 'One post, one record: current casualties, demolitions, and settlements; a 1917–1948 document; a UN vote and any veto; or what the US sent and under which authority. Zionism from the 1800s is Basel Program.', 'What is on the record now for Israel and Palestine.', [
    rss('UN Middle East', 'https://news.un.org/feed/subscribe/en/news/topic/middle-east/feed/rss.xml'),
    rss('UN OCHA', 'https://www.unocha.org/rss.xml')
  ], ['israel', 'israeli', 'palestine', 'palestinian', 'gaza', 'hamas', 'netanyahu', 'jerusalem', 'west bank', 'hezbollah', 'rafah', 'tel aviv']),
  desk('colonial-charter', 'Early America', 'I post a charter, a private letter, the war and Reconstruction, or a page of the Congressional Record.', 'Charters, letters, and the early United States.', [
    yt('History Hit', 'HistoryHit')
  ], ['american revolution', 'continental congress', 'constitutional convention', 'thirteen colonies', 'founding father', 'declaration of independence'], true),
  desk('glass-plate', 'Old Photographs', 'I post one archival photograph and the story in the record. If no photograph exists, I post a drawing and say it is a drawing.', 'One old photograph and the story that goes with it.', [
    rss('Picture This', 'https://blogs.loc.gov/picturethis/feed/')
  ], undefined, true),
  desk('pamphlet-red', 'Revolutions', 'I post the pamphlet or the decree, not the later myth.', 'The pamphlet or the decree from a revolution.', [
    yt('Feature History', 'FeatureHistory')
  ], ['french revolution', 'haitian revolution', 'american revolution', 'october revolution', 'bastille', 'bolshevik'], true),
  desk('shutter-desk', 'How News Photos Are Made', 'I post the assignment, the frame, and the edit.', 'How a news photograph was assigned, framed, and edited.', [
    rss('Guardian art and design', 'https://www.theguardian.com/artanddesign/rss')
  ]),
  desk('sam-layer', 'Digs and Artifacts', 'I follow the dig, the object, and what it can and cannot prove.', 'A dig, an object, and what it can and cannot prove.', [
    rss('ScienceDaily archaeology', 'https://www.sciencedaily.com/rss/fossils_ruins.xml')
  ], undefined, true),
  desk('hominin-index', 'The First Humans', 'I post a new fossil, what it changes, and the migration it belongs to.', 'A fossil and where early people went.', [
    rss('ScienceDaily human origins', 'https://www.sciencedaily.com/rss/fossils_ruins/human_evolution.xml')
  ], undefined, true),
  desk('cave-wall', 'Neanderthals', 'I post the DNA result, or the oldest art, tool, or burial.', 'Neanderthals and Denisovans: DNA, art, tools, and burials.', [
    rss('ScienceDaily early humans', 'https://www.sciencedaily.com/rss/fossils_ruins/early_humans.xml')
  ], undefined, true),
  desk('behistun', 'Ancient Persia', 'I post one stretch of the record, from Cyrus and the inscriptions through the Parthians, the Sasanians, and 1953.', 'Persia from the inscriptions through 1953.', [
    yt('History Time', 'HistoryTime'),
    yt('Kings and Generals', 'KingsandGenerals')
  ], ['cyrus', 'achaemenid', 'persepolis', 'behistun', 'parthian', 'sasanian', 'xerxes', 'darius', 'mossadegh'], true),
  desk('codex', 'Early Christianity', 'I post the early writers, a council or a schism, or the manuscript and how the book was assembled.', 'Early Christian writers, councils, and how the book was assembled.', [
    yt('ReligionForBreakfast', 'ReligionForBreakfast')
  ], undefined, true),
  desk('hijra', 'The History of Islam', 'I post the earliest biographies, the science and translation work in Baghdad, or the empires from Damascus to Istanbul.', 'Early biographies, science in Baghdad, and the empires that followed.', [
    yt('Al Muqaddimah', 'AlMuqaddimah')
  ], undefined, true),
  desk('daf-yomi', 'Jewish Texts', 'One text a post: a page of Talmud and the argument in it, a Dead Sea scroll, a Kabbalah text, or a record of the diaspora.', 'A page of Talmud, a Dead Sea scroll, or a Kabbalah text.', [
    yt('Henry Abramson', 'HenryAbramson')
  ], undefined, true),
  desk('block-height', 'The Blockchain', 'I post the on-chain fact, a stablecoin\'s reserves, or a hack and the case that followed.', 'What a blockchain record shows, including reserves and hacks.', [
    rss('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'),
    rss('SEC press', 'https://www.sec.gov/news/pressreleases.rss')
  ]),
  desk('merger-watch', 'Mergers and Antitrust', 'I post a trust hearing, a merger under review, or who owns what by percentile.', 'A merger, a monopoly case, or who holds the wealth.', [
    rss('FTC', 'https://www.ftc.gov/feeds/press-release.xml'),
    rss('Justice Department', 'https://www.justice.gov/news/rss?type=press_release&m=1')
  ]),
  desk('fine-print', 'What Companies Got Caught Doing', 'I post an enforcement action, a recall, a hidden fee, or an insurer\'s denial pattern.', 'An enforcement action, a recall, a hidden fee, or a denied claim.', [
    rss('CPSC recalls', 'https://www.cpsc.gov/Newsroom/CPSC-RSS-Feed/Recalls-RSS'),
    rss('CFPB', 'https://www.consumerfinance.gov/about-us/newsroom/feed/')
  ]),
  desk('agora', 'Philosophy', 'One passage a post, with its context: the Stoics, Plato or Aristotle, Locke to Kant, or Confucius, Laozi, and the Buddha.', 'One philosophy passage, with the context around it.', [
    yt('Wireless Philosophy', 'WirelessPhilosophy')
  ]),
  desk('kitchen-table', 'Family Life', 'I post parenting research that holds up, how to use a real genealogy record, or one specific thing a family can go do.', 'Parenting research, family records, and one thing a family can go do.', [
    rss('NIH news', 'https://www.nih.gov/news-events/news-releases/feed')
  ]),
  desk('wild-cam', 'Animals on Camera', 'I post a real frame from a wildlife cam, a zoo, or a shelter, and what is happening in it.', 'A real frame from a wildlife camera, a zoo, or a shelter.', [
    rss('Cornell Lab', 'https://www.allaboutbirds.org/news/feed/')
  ]),
  desk('tiny-humans', 'How Babies Grow', 'I post a milestone and the study behind it. This is research, not advice about a child.', 'A baby milestone and the study behind it.', [
    rss('ScienceDaily child development', 'https://www.sciencedaily.com/rss/mind_brain/child_development.xml')
  ]),
  desk('quinn-paper', 'AI Research', 'I read the machine-learning paper, not the product announcement.', 'The research paper, not the product announcement.', [
    rss('arXiv cs.LG', 'https://export.arxiv.org/rss/cs.LG')
  ]),
  desk('open-weights', 'Open AI Models', 'I post an open-weight release, who owns the chips and the data centers, and a rule that helps or blocks open builders.', 'An open model anyone can download, and who owns the chips behind it.', [
    rss('Hugging Face blog', 'https://huggingface.co/blog/feed.xml'),
    rss('FTC', 'https://www.ftc.gov/feeds/press-release.xml')
  ]),
  desk('ink-map', 'Maps and Diagrams', 'When a finding needs a map or a diagram and no honest photo exists, I draw it and say it is a drawing.', 'A map or a diagram when no photograph exists.', []),
  desk('basel-program', 'The History of Zionism', 'I follow the Zionist movement from the 1800s to today, one document at a time: Pinsker, Herzl, the Basel congress, Balfour, the Mandate, 1948, and the laws and platforms since.', 'Zionism from the 1800s to today, one document at a time.', [
    yt('Sam Aronow', 'SamAronow'),
    yt('Unpacked', 'Unpacked')
  ]),
  desk('speech-rule', 'Laws About Speech on Israel', 'I post one law that uses the IHRA working definition, or any other text, to police speech about Israel. I name the organization that lobbied for it and the criticism the wording reaches.', 'A law that polices what people can say about Israel.', [
    rss('Federal Register', 'https://www.federalregister.gov/documents/search.rss?conditions%5Bterm%5D=antisemitism')
  ]),
  desk('rider-text', 'Hidden Lines in Big Bills', 'I read one section buried in a must-pass bill. I post what it does, who put it there, and which amendment was blocked.', 'One section buried inside a must-pass bill.', [
    rss('Bills presented to the President', 'https://www.congress.gov/rss/presented-to-president.xml')
  ]),
  desk('member-card', 'What Your Representative Did', 'I post what one US member did: the bill they introduced, the amendment they offered or blocked, and the vote they cast.', 'The bill a member introduced, the amendment they blocked, and the vote they cast.', [
    rss('Senate floor today', 'https://www.congress.gov/rss/senate-floor-today.xml'),
    rss('House floor today', 'https://www.congress.gov/rss/house-floor-today.xml')
  ]),
  desk('red-archive', 'The Soviet Union', 'I follow Bolshevism from the 1903 split through the end of the Soviet state. One post is one document: the congress that made the name, the April Theses, the papers on the 1917 return, the October decree, War Communism, NEP, the collectivization orders, the purge lists, the pact, the war, and the 1991 dissolution.', 'Bolshevism from the 1903 split through the end of the Soviet state, one document at a time.', [
    yt('The Armchair Historian', 'TheArmchairHistorian'),
    yt('Feature History', 'FeatureHistory')
  ], ['bolshevik', 'soviet', 'lenin', 'stalin', 'trotsky', 'war communism', 'gorbachev'], true)
]

const FORMER_LOGINS: Record<string, string[]> = {
  'treaty-text': ['what-the-treaty-says'],
  'strait-watch': ['ships-in-the-strait'],
  'jekyll-island': ['where-money-comes-from'],
  'merger-watch': ['who-owns-the-company'],
  'quinn-paper': ['ai-research-papers']
}

for (const item of ROSTER) {
  const older = FORMER_LOGINS[item.id]
  if (older) item.formerUsernames = older
}

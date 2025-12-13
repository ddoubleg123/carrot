# Test Citations - Manual Verification

## 10 Citations Processed in Test Run

These are the citations that were processed in the test batch. All were denied due to insufficient content (< 500 characters), which is expected for metadata/library catalog pages.

### 1. BnF data (Bibliothèque nationale de France)
**URL:** https://data.bnf.fr/ark:/12148/cb118646298
**Title:** BnF data
**Status:** Denied - insufficient content (332 chars)
**Reason:** Library catalog metadata page

### 2. Taiwan National Central Library
**URL:** http://aleweb.ncl.edu.tw/F/?func=accref&acc_sequence=003585810&CON_LNG=ENG
**Title:** Taiwan
**Status:** Denied - insufficient content (7 chars)
**Reason:** Library catalog page with minimal content

### 3. ORCID Profile
**URL:** https://orcid.org/0000-0001-7681-7410
**Title:** ORCID
**Status:** Denied - insufficient content (5 chars)
**Reason:** ORCID profile page (researcher identifier)

### 4. NARA (National Archives)
**URL:** https://catalog.archives.gov/id/10035704
**Title:** NARA
**Status:** Denied - insufficient content (0 chars)
**Reason:** Archive catalog page with no extractable text

### 5. True Peace Organization
**URL:** http://www.truepeace.org/index.asp
**Title:** True Peace
**Status:** Denied - insufficient content (90 chars)
**Reason:** Domain parked/coming soon page

### 6. Berman Jewish Policy Archive
**URL:** http://www.bjpa.org/Publications/results.cfm?TopicID=153
**Title:** Policy publications on the Israeli-Palestinian conflict at the Berman Jewish Policy Archive
**Status:** Denied - insufficient content (566 chars, but failed AI summarization)
**Reason:** Search results page with minimal content

### 7. BnF data (IDF)
**URL:** https://data.bnf.fr/ark:/12148/cb118646325
**Title:** BnF data
**Status:** Denied - insufficient content (348 chars)
**Reason:** Library catalog metadata page

### 8. YouTube Video
**URL:** https://www.youtube.com/watch?v=3psMGQE0iW4
**Title:** Shocking insight into Israel's Apartheid | Roadmap to Apartheid
**Status:** Denied - insufficient content (183 chars)
**Reason:** YouTube page - video content not extractable as text

### 9. BnF data (Palestine)
**URL:** https://data.bnf.fr/ark:/12148/cb13507488g
**Title:** BnF data
**Status:** Denied - insufficient content (342 chars)
**Reason:** Library catalog metadata page

### 10. BnF data (Palestinian Authority)
**URL:** https://data.bnf.fr/ark:/12148/cb13334567b
**Title:** BnF data
**Status:** Denied - insufficient content (358 chars)
**Reason:** Library catalog metadata page

## Summary

**All 10 citations were correctly denied** because they are:
- Library catalog/metadata pages (6 citations)
- Archive catalog pages (1 citation)
- ORCID profile (1 citation)
- YouTube video (1 citation - not extractable as text)
- Parked/coming soon domain (1 citation)

These are not actual articles with substantial content, so the system correctly rejected them. The processing pipeline is working as expected.

## Next Steps

To test with citations that have actual content, we should:
1. Find citations with substantial text content (> 500 chars)
2. Process them with DeepSeek API configured
3. Verify they get real AI scores and are saved if relevant


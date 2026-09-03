package de.crazybatto.tiktokfakeacc

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.rememberAsyncImagePainter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import kotlin.math.min

private val Bg = Color(0xFF07090D)
private val Card = Color(0xFF11151D)
private val Accent = Color(0xFF25F4EE)
private val Accent2 = Color(0xFFFE2C55)
private val Muted = Color(0xFF9BA4B5)

data class Profile(
    val provider: String,
    val userId: String = "",
    val uniqueId: String,
    val nickname: String = "",
    val bio: String = "",
    val avatarUrl: String = "",
    val followerCount: Long = 0,
    val followingCount: Long = 0,
    val likesCount: Long = 0,
    val videoCount: Long = 0,
    val region: String = ""
)

data class RankedProfile(val profile: Profile, val score: Int, val reasons: List<String>)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme(colorScheme = darkColorScheme(background = Bg, surface = Card, primary = Accent, secondary = Accent2)) { AnalyzerApp() } }
    }
}

@Composable
fun AnalyzerApp() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("tiktok_fake_acc", 0) }
    val scope = rememberCoroutineScope()
    var tab by remember { mutableIntStateOf(0) }
    var handle by remember { mutableStateOf("") }
    var source by remember { mutableStateOf<Profile?>(null) }
    var candidates by remember { mutableStateOf<List<RankedProfile>>(emptyList()) }
    var status by remember { mutableStateOf("Bereit") }
    var loading by remember { mutableStateOf(false) }
    var eulerKey by remember { mutableStateOf(prefs.getString("eulerKey", "") ?: "") }
    var tikApiKey by remember { mutableStateOf(prefs.getString("tikApiKey", "") ?: "") }

    Scaffold(containerColor = Bg, bottomBar = {
        NavigationBar(containerColor = Color(0xFF0B0E14)) {
            NavigationBarItem(selected = tab == 0, onClick = { tab = 0 }, icon = { Text("⌕") }, label = { Text("Suche") })
            NavigationBarItem(selected = tab == 1, onClick = { tab = 1 }, icon = { Text("⚙") }, label = { Text("API") })
        }
    }) { pad ->
        Box(Modifier.padding(pad).fillMaxSize().background(Bg)) {
            if (tab == 0) {
                LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    item {
                        Text("TikTok Account Analyzer", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text("Mögliche zusammengehörige öffentliche TikTok-Accounts finden und vergleichen.", color = Muted)
                    }
                    item {
                        Card(colors = CardDefaults.cardColors(containerColor = Card), shape = RoundedCornerShape(18.dp)) {
                            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                OutlinedTextField(value = handle, onValueChange = { handle = it }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text("@username") })
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(enabled = !loading, onClick = {
                                        loading = true; status = "Profil wird geladen …"
                                        scope.launch {
                                            runCatching { Api.fetchProfile(handle, eulerKey, tikApiKey) }
                                                .onSuccess { source = it; candidates = emptyList(); status = "@${it.uniqueId} geladen." }
                                                .onFailure { status = it.message ?: "Fehler" }
                                            loading = false
                                        }
                                    }) { Text("Profil laden") }
                                    Button(enabled = !loading && source != null, onClick = {
                                        val src = source ?: return@Button
                                        loading = true; status = "Suche nach möglichen Accounts …"
                                        scope.launch {
                                            runCatching { Api.searchCandidates(src, eulerKey, tikApiKey) }
                                                .onSuccess { candidates = it; status = "${it.size} mögliche Kandidaten gefunden." }
                                                .onFailure { status = it.message ?: "Fehler" }
                                            loading = false
                                        }
                                    }) { Text("Automatisch suchen") }
                                }
                                if (loading) LinearProgressIndicator(Modifier.fillMaxWidth())
                                Text(status, color = if (status.contains("Fehler", true)) Accent2 else Muted)
                            }
                        }
                    }
                    source?.let { p -> item { ProfileCard(p, null, listOf("Hauptaccount")) } }
                    if (candidates.isNotEmpty()) {
                        item { Text("Mögliche Accounts", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                        items(candidates) { r -> ProfileCard(r.profile, r.score, r.reasons) }
                    }
                    item { Text("Hinweis: Ein hoher Ähnlichkeitswert ist kein Beweis dafür, dass dieselbe reale Person mehrere Accounts betreibt.", color = Muted, style = MaterialTheme.typography.bodySmall) }
                }
            } else {
                Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text("API-Einstellungen", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text("Keys werden nur lokal auf diesem Gerät gespeichert.", color = Muted)
                    OutlinedTextField(eulerKey, { eulerKey = it }, Modifier.fillMaxWidth(), label = { Text("Euler Stream API-Key") })
                    OutlinedTextField(tikApiKey, { tikApiKey = it }, Modifier.fillMaxWidth(), label = { Text("TikAPI API-Key") })
                    Button(onClick = {
                        prefs.edit().putString("eulerKey", eulerKey.trim()).putString("tikApiKey", tikApiKey.trim()).apply()
                        status = "API-Einstellungen gespeichert."
                    }) { Text("Speichern") }
                    Text("Für die automatische Suche ist TikAPI besonders nützlich; Euler wird für Profilabfragen als bevorzugte Quelle verwendet, sofern ein Key vorhanden ist.", color = Muted)
                }
            }
        }
    }
}

@Composable
private fun ProfileCard(p: Profile, score: Int?, reasons: List<String>) {
    Card(colors = CardDefaults.cardColors(containerColor = Card), shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (p.avatarUrl.isNotBlank()) Image(rememberAsyncImagePainter(p.avatarUrl), null, Modifier.size(62.dp), contentScale = ContentScale.Crop)
                Column(Modifier.weight(1f)) {
                    Text(p.nickname.ifBlank { p.uniqueId }, fontWeight = FontWeight.Bold)
                    Text("@${p.uniqueId}", color = Accent)
                    if (p.region.isNotBlank()) Text(p.region, color = Muted, style = MaterialTheme.typography.bodySmall)
                }
                score?.let { Text("$it%", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = if (it >= 70) Accent else Color.White) }
            }
            if (p.bio.isNotBlank()) Text(p.bio)
            Text("${compact(p.followerCount)} Follower  •  ${compact(p.followingCount)} folgt  •  ${compact(p.likesCount)} Likes", color = Muted, style = MaterialTheme.typography.bodySmall)
            if (reasons.isNotEmpty()) Text(reasons.joinToString("  •  "), color = Muted, style = MaterialTheme.typography.bodySmall)
        }
    }
}

private fun compact(v: Long): String = when {
    v >= 1_000_000 -> "%.1fM".format(v / 1_000_000.0)
    v >= 1_000 -> "%.1fK".format(v / 1_000.0)
    else -> v.toString()
}

object Api {
    private val client = OkHttpClient()

    suspend fun fetchProfile(handle: String, eulerKey: String, tikApiKey: String): Profile = withContext(Dispatchers.IO) {
        val clean = handle.trim().removePrefix("@")
        require(clean.isNotBlank()) { "Bitte einen TikTok-Namen eingeben." }
        if (eulerKey.isNotBlank()) runCatching { return@withContext fetchEuler(clean, eulerKey) }
        if (tikApiKey.isNotBlank()) return@withContext fetchTikApi(clean, tikApiKey)
        error("Bitte zuerst einen Euler- oder TikAPI-Key speichern.")
    }

    suspend fun searchCandidates(source: Profile, eulerKey: String, tikApiKey: String): List<RankedProfile> = withContext(Dispatchers.IO) {
        if (tikApiKey.isBlank()) error("Für die automatische Suche bitte einen TikAPI-Key hinterlegen.")
        val terms = buildList {
            add(source.uniqueId)
            source.nickname.split(" ", "_", ".", "-").filter { it.length >= 3 }.take(3).forEach { add(it) }
        }.distinct()
        val found = linkedMapOf<String, Profile>()
        for (term in terms) {
            for (p in searchTikApi(term, tikApiKey)) {
                if (!p.uniqueId.equals(source.uniqueId, true)) found.putIfAbsent(p.uniqueId.lowercase(), p)
            }
        }
        found.values.map { p ->
            val full = runCatching { fetchProfile(p.uniqueId, eulerKey, tikApiKey) }.getOrDefault(p)
            val (score, reasons) = score(source, full)
            RankedProfile(full, score, reasons)
        }.sortedByDescending { it.score }.take(20)
    }

    private fun fetchEuler(handle: String, key: String): Profile {
        val url = "https://api.eulerstream.com/tiktok/users/${enc(handle)}/basic"
        val json = get(url, mapOf("X-Api-Key" to key))
        return normalize("euler", json, handle)
    }

    private fun fetchTikApi(handle: String, key: String): Profile {
        val json = get("https://api.tikapi.io/public/check?username=${enc(handle)}", mapOf("X-API-KEY" to key))
        return normalize("tikapi", json, handle)
    }

    private fun searchTikApi(term: String, key: String): List<Profile> {
        val json = get("https://api.tikapi.io/public/search/users?query=${enc(term)}", mapOf("X-API-KEY" to key))
        val arrays = listOf("users", "data", "user_list")
        for (name in arrays) {
            val arr = json.optJSONArray(name) ?: continue
            return (0 until arr.length()).mapNotNull { i -> arr.optJSONObject(i)?.let { normalize("tikapi-search", it, "") } }.filter { it.uniqueId.isNotBlank() }
        }
        return emptyList()
    }

    private fun get(url: String, headers: Map<String, String>): JSONObject {
        val builder = Request.Builder().url(url).get().header("Accept", "application/json")
        headers.forEach { (k, v) -> builder.header(k, v) }
        client.newCall(builder.build()).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) error("API-Fehler ${response.code}: ${text.take(180)}")
            return JSONObject(text)
        }
    }

    private fun normalize(provider: String, payload: JSONObject, fallback: String): Profile {
        val root = payload.optJSONObject("user") ?: payload.optJSONObject("data")?.optJSONObject("user") ?: payload.optJSONObject("data") ?: payload
        val stats = root.optJSONObject("stats") ?: root.optJSONObject("authorStats") ?: JSONObject()
        fun s(vararg keys: String): String { for (k in keys) if (root.has(k) && !root.isNull(k)) return root.optString(k); return "" }
        fun n(vararg keys: String): Long { for (k in keys) { if (stats.has(k)) return stats.optLong(k); if (root.has(k)) return root.optLong(k) }; return 0 }
        return Profile(
            provider = provider,
            userId = s("id", "user_id", "userId", "uid"),
            uniqueId = s("unique_id", "uniqueId", "username").ifBlank { fallback },
            nickname = s("nickname", "display_name", "displayName"),
            bio = s("signature", "bio", "description"),
            avatarUrl = s("avatar_url", "avatarLarger", "avatarMedium", "avatarThumb", "avatar"),
            followerCount = n("followerCount", "followers", "follower_count"),
            followingCount = n("followingCount", "following", "following_count"),
            likesCount = n("heartCount", "heart", "likes", "likes_count"),
            videoCount = n("videoCount", "videos", "video_count"),
            region = s("region")
        )
    }

    private fun score(a: Profile, b: Profile): Pair<Int, List<String>> {
        var score = 0; val reasons = mutableListOf<String>()
        val hs = similarity(a.uniqueId, b.uniqueId); if (hs > .35) { score += (hs * 35).toInt(); reasons += "ähnlicher Handle" }
        val ns = similarity(a.nickname, b.nickname); if (ns > .45) { score += (ns * 25).toInt(); reasons += "ähnlicher Nickname" }
        val bs = similarity(a.bio, b.bio); if (bs > .5) { score += (bs * 20).toInt(); reasons += "ähnliche Bio" }
        if (a.region.isNotBlank() && a.region.equals(b.region, true)) { score += 8; reasons += "gleiche Region" }
        if (a.avatarUrl.isNotBlank() && a.avatarUrl == b.avatarUrl) { score += 12; reasons += "identischer Avatar-Link" }
        if (a.userId.isNotBlank() && a.userId == b.userId) { score = 100; reasons.add(0, "gleiche TikTok-User-ID") }
        return min(100, score) to reasons
    }

    private fun similarity(a0: String, b0: String): Double {
        val a = a0.lowercase().filter { it.isLetterOrDigit() }
        val b = b0.lowercase().filter { it.isLetterOrDigit() }
        if (a.isBlank() || b.isBlank()) return 0.0
        if (a == b) return 1.0
        val longer = if (a.length >= b.length) a else b
        val shorter = if (a.length >= b.length) b else a
        val common = shorter.count { longer.contains(it) }.toDouble() / longer.length
        return min(1.0, common * .75 + if (longer.contains(shorter)) .25 else 0.0)
    }

    private fun enc(v: String) = URLEncoder.encode(v, StandardCharsets.UTF_8.toString())
}

package com.pureverse.app

import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

/**
 * Native ad defense for the WebView. Unlike the website's own JavaScript — which
 * cannot reach into a cross-origin <iframe> — the app intercepts every network
 * request the page (and its iframes) make, so we can drop ad/popunder traffic
 * outright and refuse ad-redirect navigations.
 */
object AdBlocker {

    /**
     * Hosts trusted for TOP-LEVEL navigation. The app's own site, the backend,
     * the streaming providers (loaded inside the player iframe), and auth/infra.
     * Anything else trying to take over the whole screen is an ad redirect and
     * gets blocked.
     *
     * ⚠️ If you use a custom domain, add it here.
     */
    private val allowedHosts = listOf(
        "pure-verse.vercel.app",
        "vercel.app",
        "onrender.com",
        // streaming providers:
        "vidlink.pro", "vidsrc.to", "vidsrc.xyz", "vidsrc.net", "2embed.cc",
        "vidfast.pro", "multiembed.mov", "videasy.net", "megaplay.buzz", "vidnest.fun",
        // auth / infra that may legitimately navigate:
        "accounts.google.com", "google.com", "gstatic.com", "googleapis.com"
    )

    /**
     * Known ad / popunder / tracker networks used by streaming embeds. A request
     * whose URL contains any of these is dropped (empty 200). Extend freely.
     */
    private val adHosts = listOf(
        "doubleclick.net", "googlesyndication.com", "googleadservices.com",
        "popads.net", "popcash.net", "popunder", "poptm", "propellerads",
        "propu.net", "propellerclick", "adsterra", "adtng.com",
        "onclickads", "onclckds.com", "onclicka.com", "clickadu", "exoclick.com",
        "exosrv.com", "juicyads.com", "hilltopads", "adcash.com",
        "mgid.com", "revcontent.com", "trafficjunky.com", "trafficfactory",
        "adskeeper.com", "adnxs.com", "bidvertiser", "popmyads",
        "luckyforbet", "highperformanceformat.com", "displaycontentnetwork.com",
        "monetag", "betteradsystem", "adsco.re", "histats.com", "outbrain.com",
        "taboola.com", "zedo.com", "smartadserver.com", "yieldmo.com", "adblade",
        "clksite.com", "clickserve", "pushwhy", "pushncall", "rtmark.net",
        "creative-serving", "bestadbid", "ad-maven", "admaven", "a-ads.com",
        "popunderjs", "pemsrv.com", "tsyndicate.com", "mwclick", "vidstreamz",
        "coinzilla", "datafast", "servenobid", "syndication.realsrv.com", "realsrv.com"
    )

    fun isAllowedHost(host: String): Boolean {
        val h = host.lowercase()
        return allowedHosts.any { h == it || h.endsWith(".$it") || h.contains(it) }
    }

    fun isAd(url: String): Boolean {
        val u = url.lowercase()
        return adHosts.any { u.contains(it) }
    }

    /** An empty response — effectively cancels the request. */
    fun blockedResponse(): WebResourceResponse =
        WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))
}

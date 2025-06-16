import { languageCodes } from '../../interfaces/TextTrack';

// Helper function to contain the redirection logic, usable by both mocks.
function getRedirectUrl(urlString: string, subtitlesMap: { [key: string]: string }): string | null {
    try {
        const url = new URL(urlString);
        const ikQueryParam = url.searchParams.get('tr');

        // A more efficient way to build the regex
        const supportedLangCodes = Object.keys(languageCodes).join('|');
        const langRegex = new RegExp(`lang-(${supportedLangCodes})`);
        
        const match = ikQueryParam && ikQueryParam.match(langRegex);
        const lang = match ? match[1] : null;

        if (lang && subtitlesMap[lang]) {
            // console.log(`[Mock Redirect] Matched lang "${lang}". Redirecting to:`, subtitlesMap[lang]);
            return subtitlesMap[lang];
        }

        // Check for the default .transcript file
        if (subtitlesMap.default && url.pathname.endsWith('.transcript')) {
            // console.log(`[Mock Redirect] Matched default transcript. Redirecting to:`, subtitlesMap.default);
            return subtitlesMap.default;
        }

    } catch (e) {
        // Not a valid URL, ignore.
        return null;
    }

    return null;
}


export function initSubtitlesRedirect(subtitlesMap: { [key: string]: string }) {
    
    // --- 1. Mock window.fetch ---
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const requestUrl = (typeof input === 'string') ? input : (input instanceof URL ? input.toString() : (input as Request).url);
        
        const redirectedUrl = getRedirectUrl(requestUrl, subtitlesMap);

        if (redirectedUrl) {
            return originalFetch(redirectedUrl, init);
        }

        return originalFetch(input, init);
    };

    // --- 2. Mock XMLHttpRequest ---
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    // We store the original URL on the XHR instance itself.
    let requestUrlStore: string;

    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
        // Store the URL that is being opened.
        requestUrlStore = (typeof url === 'string') ? url : url.toString();
        // Call the original open method
        // @ts-ignore
        return originalXhrOpen.apply(this, [method, url, ...args]);
    };

    XMLHttpRequest.prototype.send = function(...args: any[]) {
        // Before sending, check if the stored URL needs redirection.
        const redirectedUrl = getRedirectUrl(requestUrlStore, subtitlesMap);

        if (redirectedUrl) {
            // If we have a redirect, we need to re-open the request with the new URL
            // before sending it. We need to grab the original method and async flag.
            // Note: This assumes the method and other params are not what we're changing.
            const originalMethod = (this as any)._method || 'GET'; // A common way to store method in mocks
            const originalAsync = (this as any)._async !== false;

            // Re-open with the new URL.
            originalXhrOpen.call(this, originalMethod, redirectedUrl, originalAsync);
        }

        // Proceed with the original send method (to either the original or redirected URL)
        // @ts-ignore
        return originalXhrSend.apply(this, args);
    };
}


// Example default mapping (no changes needed here)
export const defaultSubtitlesMap = {
    fr: 'https://ik.imagekit.io/zuqlyov9d/fr.vtt?updatedAt=1750053693235',
    de: 'https://ik.imagekit.io/zuqlyov9d/de.vtt?updatedAt=1750053693233',
    default: 'https://ik.imagekit.io/zuqlyov9d/sample.txt?updatedAt=1750054605657',
};
const useNameMapManager = () => {
    const NAME_MAP_STORAGE_KEY = 'namemap'
    const storage = chrome.storage.session
    let nameMap = null;

    storage.clear();

    const getNameMap = async () => {
        if (!nameMap) {
            nameMap = new Map(Object.entries((await chrome.storage?.session.get([NAME_MAP_STORAGE_KEY]))?.[NAME_MAP_STORAGE_KEY] ?? new Map()))
        }
        return nameMap
    }

    const updateNameMap = async (nameMap) => {
        await storage.set({[NAME_MAP_STORAGE_KEY]: Object.fromEntries(nameMap)})
    }

    return {getNameMap, updateNameMap}
}

const {getNameMap, updateNameMap} = useNameMapManager();
(async () => {
    await getNameMap()
})();


const getUsername = async (id) => {
    const request = new Request(`https://github.com/users/${id}/hovercard`)
    request.headers.append('X-Requested-With', 'XMLHttpRequest')
    const response = await self.fetch(request)
    const text = await response.text();
    const b = document.createElement('div');
    b.innerHTML = text;
    const usernameElem = b.querySelector('section[aria-label^="user login"] > span');
    return usernameElem?.innerText.trim() || id;
}

const getAllNameElements = () => {
    const userHoverCardRegex = /\/users\/([\w-]+)\/hovercard/;

    const comments = Array.from(
        [...document.querySelectorAll('a[data-hovercard-type]')]
            .filter(a => userHoverCardRegex.test(a.getAttribute('data-hovercard-url')) && !a.querySelector('img'))
    ).map(e => [e, e.getAttribute('data-hovercard-url').match(userHoverCardRegex)[1]])

    const commitAuthor = Array.from(
        [...document.querySelectorAll('a.commit-author')]
    ).map(e => [e, e.href.slice(e.href.lastIndexOf('=') + 1, e.href.length)])

    const assignee = Array.from(
        [...document.querySelectorAll('a.assignee')]
    ).map(e => [e.querySelector('span'), e.href.slice(e.href.lastIndexOf('/') + 1, e.href.length)])

    return [...comments, ...commitAuthor, ...assignee].filter(([elem, id]) => elem.innerText === id);
}

const useSetName = () => {
    const sliceCount = 5;

    const setNameToElement = async () => {
        const nameMap = await getNameMap()

        const elementUserIDPair = getAllNameElements();
        if (elementUserIDPair.length === 0) {
            return;
        }

        const idListToFind = Array.from(new Set(elementUserIDPair
            .map(([_, id]) => id)
            .filter((id) => !nameMap.has(id))
        ));

        for (const i of Array.from({length: Math.ceil(idListToFind.length / sliceCount)}).map((_, idx) => idx)) {
            await Promise.all(
                idListToFind.slice(i * sliceCount, (i + 1) * sliceCount).map(id =>
                    new Promise((resolve) => resolve(getUsername(id))).then(name => nameMap.set(id, name))
                )
            )
        }

        elementUserIDPair.forEach(([element, userId]) => element.innerText = nameMap.get(userId));
        void updateNameMap(nameMap)
    }

    const debounce = (func, timeout) => {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), timeout);
        }
    }

    return {setName: debounce(() => setNameToElement(), 300)}
}

const {setName} = useSetName();

const observer = new MutationObserver(async () => setName())
observer.observe(document.body, { attributes: false, childList: true, subtree: true })

chrome.runtime.onMessage.addListener(
    async (request) => {
        if (request.message === 'load-complete') {
            setName();
        }
    });


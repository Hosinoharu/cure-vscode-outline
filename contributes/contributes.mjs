const get_cmds = (items) => items.map((item) => item.cmd);
const get_menus = (items) => items.map((item) => item.menu);
const create_result = (items) => ({ cmd: get_cmds(items), menu: get_menus(items) });

// 重新加载符号
const reload = {
    cmd: [
        {
            command: "cure-outline.reload-symbol",
            title: "Reload Current File Symbol",
            icon: "$(refresh)",
        },
    ],
    menu: [
        {
            command: "cure-outline.reload-symbol",
            when: "view == cure-outline",
            group: "navigation@1",
        },
    ],
};

// 展开符号
const expand = (() => {
    const expand_all = {
        cmd: {
            command: "cure-outline.expand-all",
            title: "Expand All",
            icon: "$(expand-all)",
        },
        menu: {
            command: "cure-outline.expand-all",
            when: "view == cure-outline && !cure-outline-is-expand-all",
            group: "navigation@2",
        },
    };
    const expand_all_off = {
        cmd: {
            command: "cure-outline.expand-all-off",
            title: "Collapse All",
            icon: "$(collapse-all)",
        },
        menu: {
            command: "cure-outline.expand-all-off",
            when: "view == cure-outline && cure-outline-is-expand-all",
            group: "navigation@2",
        },
    };
    const expand_only_one = {
        cmd: {
            command: "cure-outline.expand-only-one",
            title: "Expand Only One",
        },
        menu: {
            command: "cure-outline.expand-only-one",
            when: "view == cure-outline && !cure-outline-is-expand-only-one",
            group: "expand@1",
        },
    };
    const expand_only_one_off = {
        cmd: {
            command: "cure-outline.expand-only-one-off",
            title: "✔ Expand Only One",
            // 不知道为什么不能在菜单前面加图标
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.expand-only-one-off",
            when: "view == cure-outline && cure-outline-is-expand-only-one",
            group: "expand@1",
        },
    };

    return create_result([expand_all, expand_all_off, expand_only_one, expand_only_one_off]);
})();

// 排序
const sort = (() => {
    const sort_by_position = {
        cmd: {
            command: "cure-outline.sort-by-position",
            title: "Sort By Position",
        },
        menu: {
            command: "cure-outline.sort-by-position",
            when: "view == cure-outline && !cure-outline-is-sort-by-position",
            group: "sort@1",
        },
    };
    const sort_by_postion_off = {
        cmd: {
            command: "cure-outline.sort-by-position-off",
            title: "✔ Sort By Position",
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.sort-by-position-off",
            when: "view == cure-outline && cure-outline-is-sort-by-position",
            group: "sort@1",
        },
    };
    const sort_by_name = {
        cmd: {
            command: "cure-outline.sort-by-name",
            title: "Sort By Name",
        },
        menu: {
            command: "cure-outline.sort-by-name",
            when: "view == cure-outline && !cure-outline-is-sort-by-name",
            group: "sort@2",
        },
    };
    const sort_by_name_off = {
        cmd: {
            command: "cure-outline.sort-by-name-off",
            title: "✔ Sort By Name",
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.sort-by-name-off",
            when: "view == cure-outline && cure-outline-is-sort-by-name",
            group: "sort@2",
        },
    };
    const sort_by_kind = {
        cmd: {
            command: "cure-outline.sort-by-kind",
            title: "Sort By Kind",
        },
        menu: {
            command: "cure-outline.sort-by-kind",
            when: "view == cure-outline && !cure-outline-is-sort-by-kind",
            group: "sort@3",
        },
    };
    const sort_by_kind_off = {
        cmd: {
            command: "cure-outline.sort-by-kind-off",
            title: "✔ Sort By Kind",
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.sort-by-kind-off",
            when: "view == cure-outline && cure-outline-is-sort-by-kind",
            group: "sort@3",
        },
    };

    return create_result([
        sort_by_position,
        sort_by_postion_off,
        sort_by_name,
        sort_by_name_off,
        sort_by_kind,
        sort_by_kind_off,
    ]);
})();

// ==========================
//         整合各命令
// ==========================

const commands = [...reload.cmd, ...expand.cmd, ...sort.cmd];

const menus = {
    "view/title": [...reload.menu, ...expand.menu, ...sort.menu],
};

export default {
    commands,
    viewsContainers: {
        activitybar: [
            {
                id: "cure-outline",
                title: "Cure Outline",
                icon: "icons/icon-24.png",
            },
        ],
    },
    views: {
        "cure-outline": [
            {
                id: "cure-outline",
                name: "Cure Outline",
                icon: "icons/icon-24.png",
            },
        ],
    },
    menus,
};

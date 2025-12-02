const get_cmds = (items) => items.map((item) => item.cmd);
const get_menus = (items) => items.map((item) => item.menu);
const create_result = (items) => ({ cmd: get_cmds(items), menu: get_menus(items) });

// 重新加载符号
const reload_symbol = {
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
// 重新加载自定义书签
const reload_bookmark = {
    cmd: [
        {
            command: "cure-outline.reload-bookmark",
            title: "Reload Current File Bookmark",
            icon: "$(refresh)",
        },
    ],
    menu: [
        {
            command: "cure-outline.reload-bookmark",
            when: "view == cure-outline-bookmark",
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
    // const expand_only_one = {
    //     cmd: {
    //         command: "cure-outline.expand-only-one",
    //         title: "Expand Only One",
    //     },
    //     menu: {
    //         command: "cure-outline.expand-only-one",
    //         when: "view == cure-outline && !cure-outline-is-expand-only-one",
    //         group: "expand@1",
    //     },
    // };
    // const expand_only_one_off = {
    //     cmd: {
    //         command: "cure-outline.expand-only-one-off",
    //         title: "✔ Expand Only One",
    //         // 不知道为什么不能在菜单前面加图标
    //         icon: "$(check)",
    //     },
    //     menu: {
    //         command: "cure-outline.expand-only-one-off",
    //         when: "view == cure-outline && cure-outline-is-expand-only-one",
    //         group: "expand@1",
    //     },
    // };

    return create_result([expand_all, expand_all_off]);
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

// 过滤
const filter = (() => {
    const filter_no_local_var = {
        cmd: {
            command: "cure-outline.filter-no-local-var",
            title: "No Local Var",
        },
        menu: {
            command: "cure-outline.filter-no-local-var",
            when: "view == cure-outline && !cure-outline-is-filter-no-local-var",
            group: "filter@1",
        },
    };
    const filter_no_local_var_off = {
        cmd: {
            command: "cure-outline.filter-no-local-var-off",
            title: "✔ No Local Var",
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.filter-no-local-var-off",
            when: "view == cure-outline && cure-outline-is-filter-no-local-var",
            group: "filter@1",
        },
    };
    const filter_no_global_var = {
        cmd: {
            command: "cure-outline.filter-no-global-var",
            title: "No Global Var",
        },
        menu: {
            command: "cure-outline.filter-no-global-var",
            when: "view == cure-outline && !cure-outline-is-filter-no-global-var",
            group: "filter@2",
        },
    };
    const filter_no_global_var_off = {
        cmd: {
            command: "cure-outline.filter-no-global-var-off",
            title: "✔ No Global Var",
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.filter-no-global-var-off",
            when: "view == cure-outline && cure-outline-is-filter-no-global-var",
            group: "filter@2",
        },
    };

    return create_result([
        filter_no_local_var,
        filter_no_local_var_off,
        filter_no_global_var,
        filter_no_global_var_off,
    ]);
})();

// 在 tree item 上的操作
const view_item_context = (() => {
    const add_symbol_to_bookmark = {
        cmd: {
            command: "cure-outline.add-symbol-to-bookmark",
            title: "Add Bookmark",
        },
        menu: {
            command: "cure-outline.add-symbol-to-bookmark",
            when: "view == cure-outline",
        },
    };
    const rename_bookmark = {
        cmd: {
            command: "cure-outline.rename-bookmark",
            title: "Rename",
            icon: "$(edit)",
        },
        menu: {
            command: "cure-outline.rename-bookmark",
            group: "inline@1",
            // 自定义标签（从代码中解析出来的、特定格式的标签）不能在 tree view 中编辑哟
            when: "view == cure-outline-bookmark && viewItem == bookmark_item",
        },
    };
    const del_bookmark = {
        cmd: {
            command: "cure-outline.del-bookmark",
            title: "Delete",
            icon: "$(close)",
        },
        menu: {
            command: "cure-outline.del-bookmark",
            group: "inline@2",
            when: "view == cure-outline-bookmark && viewItem == bookmark_item",
        },
    };

    return create_result([add_symbol_to_bookmark, rename_bookmark, del_bookmark]);
})();

// ==========================
//         整合各命令
// ==========================

const commands = [
    ...reload_symbol.cmd,
    ...reload_bookmark.cmd,
    ...expand.cmd,
    ...sort.cmd,
    ...filter.cmd,
    ...view_item_context.cmd,
];

const menus = {
    "view/title": [
        ...reload_symbol.menu,
        ...reload_bookmark.menu,
        ...expand.menu,
        ...sort.menu,
        ...filter.menu,
    ],
    "view/item/context": [...view_item_context.menu],
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
            {
                id: "cure-outline-bookmark",
                name: "Cure Bookmark",
                icon: "icons/icon-24.png",
            },
        ],
    },
    menus,
};

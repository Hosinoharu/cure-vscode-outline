const command_palette = [];
const get_cmds = (items) =>
    items.map((item) => {
        item.cmd.category = "Cure Outline";
        command_palette.push({ command: item.cmd.command, when: "false" });
        return item.cmd;
    });
const get_menus = (items) => items.map((item) => item.menu);
const create_result = (items) => ({ cmd: get_cmds(items), menu: get_menus(items) });

// 重新加载符号。navigation@1
const reload_symbol = {
    cmd: {
        command: "cure-outline.reload-symbol",
        title: "Reload Current File Symbol",
        icon: "$(refresh)",
    },
    menu: {
        command: "cure-outline.reload-symbol",
        when: "view == cure-outline",
        group: "navigation@1",
    },
};
command_palette.push({ command: reload_symbol.cmd.command, when: "false" });
// 重新加载自定义书签。navigation@1
const reload_bookmark = {
    cmd: {
        command: "cure-outline.reload-bookmark",
        title: "Reload Current File Bookmark",
        icon: "$(refresh)",
    },
    menu: {
        command: "cure-outline.reload-bookmark",
        when: "view == cure-outline-bookmark",
        group: "navigation@1",
    },
};
command_palette.push({ command: reload_bookmark.cmd.command, when: "false" });

// follow cursor、follow viewport。1_follow@1、1_follow@2
const follow = (() => {
    const follow_cursor = {
        cmd: {
            command: "cure-outline.follow-cursor",
            title: "Follow Cursor",
        },
        menu: {
            command: "cure-outline.follow-cursor",
            when: "view == cure-outline && !cure-outline-is-follow-cursor",
            // 为了让它位于最上方
            group: "1_follow@1",
        },
    };
    const follow_cursor_off = {
        cmd: {
            command: "cure-outline.follow-cursor-off",
            title: "✔ Follow Cursor",
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.follow-cursor-off",
            when: "view == cure-outline && cure-outline-is-follow-cursor",
            group: "1_follow@1",
        },
    };
    const follow_viewport = {
        cmd: {
            command: "cure-outline.follow-viewport",
            title: "Follow Viewport",
        },
        menu: {
            command: "cure-outline.follow-viewport",
            when: "view == cure-outline && !cure-outline-is-follow-viewport",
            group: "1_follow@2",
        },
    };
    const follow_viewport_off = {
        cmd: {
            command: "cure-outline.follow-viewport-off",
            title: "✔ Follow Viewport",
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.follow-viewport-off",
            when: "view == cure-outline && cure-outline-is-follow-viewport",
            group: "1_follow@2",
        },
    };

    return create_result([follow_cursor, follow_cursor_off, follow_viewport, follow_viewport_off]);
})();

// 展开符号。navigation@2、1_follow@3
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
    const editor_auto_expand = {
        cmd: {
            command: "cure-outline.editor-auto-expand",
            title: "Editor Follow Expand",
        },
        menu: {
            command: "cure-outline.editor-auto-expand",
            when: "view == cure-outline && !cure-outline-is-editor-auto-expand",
            group: "1_follow@3",
        },
    };
    const editor_auto_expand_off = {
        cmd: {
            command: "cure-outline.editor-auto-expand-off",
            title: "✔ Editor Follow Expand",
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.editor-auto-expand-off",
            when: "view == cure-outline && cure-outline-is-editor-auto-expand",
            group: "1_follow@3",
        },
    };

    return create_result([expand_all, expand_all_off, editor_auto_expand, editor_auto_expand_off]);
})();

// 排序。3_sort
const sort = (() => {
    const sort_by_position = {
        cmd: {
            command: "cure-outline.sort-by-position",
            title: "Sort By Position",
        },
        menu: {
            command: "cure-outline.sort-by-position",
            when: "view == cure-outline && !cure-outline-is-sort-by-position",
            group: "3_sort@1",
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
            group: "3_sort@1",
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
            group: "3_sort@2",
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
            group: "3_sort@2",
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
            group: "3_sort@3",
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
            group: "3_sort@3",
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

// 过滤。2_filter
const filter = (() => {
    const filter_no_local_var = {
        cmd: {
            command: "cure-outline.filter-no-local-var",
            title: "No Local Var",
        },
        menu: {
            command: "cure-outline.filter-no-local-var",
            when: "view == cure-outline && !cure-outline-is-filter-no-local-var",
            group: "2_filter@1",
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
            group: "2_filter@1",
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
            group: "2_filter@2",
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
            group: "2_filter@2",
        },
    };
    const filter_no_propety = {
        cmd: {
            command: "cure-outline.filter-no-property",
            title: "No Property",
        },
        menu: {
            command: "cure-outline.filter-no-property",
            when: "view == cure-outline && !cure-outline-is-filter-no-property",
            group: "2_filter@3",
        },
    };
    const filter_no_property_off = {
        cmd: {
            command: "cure-outline.filter-no-property-off",
            title: "✔ No Property",
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.filter-no-property-off",
            when: "view == cure-outline && cure-outline-is-filter-no-property",
            group: "2_filter@3",
        },
    };

    return create_result([
        filter_no_local_var,
        filter_no_local_var_off,
        filter_no_global_var,
        filter_no_global_var_off,
        filter_no_propety,
        filter_no_property_off,
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
            group: "1_add",
        },
    };
    // 仅折叠、展开一个 item 的所有层级
    const expand_item_all = {
        cmd: {
            command: "cure-outline.expand-item-all",
            title: "Expand All",
        },
        menu: {
            command: "cure-outline.expand-item-all",
            when: "view == cure-outline",
            group: "2_expand@1",
        },
    };
    const expand_item_all_off = {
        cmd: {
            command: "cure-outline.expand-item-all-off",
            title: "Collapse All",
            icon: "$(check)",
        },
        menu: {
            command: "cure-outline.expand-item-all-off",
            when: "view == cure-outline",
            group: "2_expand@2",
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

    return create_result([
        add_symbol_to_bookmark,
        expand_item_all,
        expand_item_all_off,
        rename_bookmark,
        del_bookmark,
    ]);
})();

// 配置项
const configuration = {
    type: "object",
    title: "Cure Outline",
    properties: {
        "cure-outline.filterType": {
            type: "array",
            default: [],
            description: "Filter Type",
            items: {
                type: "string",
                enum: ["no-local-var", "no-global-var", "no-property"],
            },
        },
    },
};

// ==========================
//         整合各命令
// ==========================

const commands = [
    reload_symbol.cmd,
    reload_bookmark.cmd,
    ...follow.cmd,
    ...expand.cmd,
    ...sort.cmd,
    ...filter.cmd,
    ...view_item_context.cmd,
];

const menus = {
    commandPalette: command_palette,
    "view/title": [
        reload_symbol.menu,
        reload_bookmark.menu,
        ...follow.menu,
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
    viewsWelcome: [
        {
            view: "cure-outline",
            contents: "No Symbol Found In Current File",
        },
    ],
    configuration,
};

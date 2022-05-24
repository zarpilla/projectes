'use strict';

/**
 * An asynchronous bootstrap function that runs before
 * your application gets started.
 *
 * This gives you an opportunity to set up your data model,
 * run jobs, or perform some special logic.
 *
 * See more details here: https://strapi.io/documentation/developer-docs/latest/setup-deployment-guides/configurations.html#bootstrap
 */



 async function setPermissions(role, type, newPermissions) {
    // Find the ID of the public role
    const publicRole = await strapi
      .query("role", "users-permissions")
      .findOne({ type: role });
  
    // List all available permissions
    const publicPermissions = await strapi
      .query("permission", "users-permissions")
      .find({ type: type, role: publicRole.id, _limit: -1 });

    // Update permission to match new config
    const controllersToUpdate = Object.keys(newPermissions);
    const updatePromises = publicPermissions
      .filter((permission) => {
        // Only update permissions included in newConfig
        if (!controllersToUpdate.includes(permission.controller)) {
          return false;
        }
        if (!newPermissions[permission.controller].includes(permission.action)) {
          return false;
        }
        return true;
      })
      .map((permission) => {
        // Enable the selected permissions
        return strapi
          .query("permission", "users-permissions")
          .update({ id: permission.id }, { enabled: true });
      });
  
    await Promise.all(updatePromises);
}


async function importSeedData() {
    // Permissions
    await setPermissions("authenticated", "application", {
        "emitted-invoice": ["create", "find", "findone", "update", "delete", "payvat"],
        "received-invoice": ["create", "find", "findone", "update", "delete"],
        "received-income": ["create", "find", "findone", "update", "delete"],
        "received-expense": ["create", "find", "findone", "update", "delete"],
        "payroll": ["create", "find", "findone", "update", "delete"],
        "project": ["create", "find", "findone", "update", "delete", "findwithbasicinfo", "payexpense", "payincome", "findwitheconomicdetail"],
        "quote": ["create", "find", "findone", "update", "delete"],
        "contact": ["create", "find", "findone", "update", "delete"],
        "festive-type": ["find"],
        "festive": ["create", "find", "findone", "update", "delete"],
        "daily-dedication": ["create", "find", "findone", "update", "delete"],        
        "document-type": ["find", "findone"],
        "users-permissions": ["me", "find", "findone"],
        "regions": ["find", "findone"],
        "task": ["create", "find", "findone", "update", "delete"],
        "task-state": ["find", "findone"],
        "kanban-view": ["create", "find", "findone", "update", "delete"],
        "justifications": ["create", "find", "findone", "update", "delete"],
        
    });


    await setPermissions("authenticated", "upload", {
      "upload": ["upload"]
    })

    // await setPermissions("public", "application", {
    //   "emitted-invoice": ["payVat"],
    // });
}

module.exports = async () => {
    await importSeedData();
};

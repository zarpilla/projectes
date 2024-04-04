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
        "activity": ["create", "find", "update", "delete", "importcalendar", "move", "totalByDay"],
        "activity-type": ["create", "find", "getBasic"],
        "emitted-invoice": ["create", "find", "findbasic", "findone", "update", "delete", "payvat", "pdf", "sendinvoicebyemail"],
        "received-invoice": ["create", "find", "findbasic", "findone", "update", "delete"],
        "received-income": ["create", "find", "findbasic", "findone", "update", "delete"],
        "received-expense": ["create", "find", "findbasic", "findone", "update", "delete"],
        "payroll": ["create", "find", "findone", "update", "delete", "createAll"],
        "project": ["create", "find", "findone", "update", "delete", "findwithbasicinfo", "findestimatedtotalsbyday", "findNames",  "findwithphases", "payexpense", "payincome", "findwitheconomicdetail", "findChildren", "doCalculateProjectInfo", "getProjectIsDirty"],
        "quote": ["create", "find", "findone", "update", "delete"],
        "contact": ["create", "find", "findone", "update", "delete", "basic"],
        "festive-type": ["find"],
        "festive": ["create", "find", "findone", "update", "delete"],
        "daily-dedication": ["create", "find", "findone", "update", "delete"],        
        "document-type": ["find", "findone"],
        "users-permissions": ["me", "find", "findone"],
        "regions": ["find", "findone"],
        "task": ["create", "find", "findone", "update", "delete"],
        "task-state": ["find", "findone"],
        "treasury": ["create", "find", "forecast", "findone", "update", "delete"],
        "kanban-view": ["create", "find", "findone", "update", "delete"],
        "justifications": ["create", "find", "findone", "update", "delete"],
        "workday-log": ["create", "find", "findone", "update", "delete"],
        "product": ["find", "findone"],
        "user-festive": ["find"],
        "orders": ["create", "find", "findone", "update", "delete"],
        "orders-imports": ["create", "find", "findone", "update"],
        "pickups": ["find"],
        
    });


    await setPermissions("authenticated", "upload", {
      "upload": ["upload"],      
    })

    // set user permissions
    const users = await strapi
      .query("user", "users-permissions")
      .find({ _limit: -1 });

    for await (const user of users) {
      if (user.permissions.length === 0 && user.blocked === false) {
        await strapi
          .query("user", "users-permissions")
          .update({ id: user.id }, { permissions: [{ permission: 'projects' }] });
      }        
    }

}

module.exports = async () => {
    await importSeedData();
};

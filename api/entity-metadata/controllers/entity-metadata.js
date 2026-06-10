'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  /**
   * Get admin-manageable entities with their schema metadata
   */
  async adminEntities(ctx) {
    try {
      // Define the entities that can be managed through the admin interface
      // Map entity folder name to API path (which is often plural)
      const adminEntities = {
        'bank-accounts': 'bank-accounts',
        'contact-type': 'contact-types',
        'dedication-type': 'dedication-types',
        'expense-type': 'expense-types',
        'income-type': 'income-types',
        'legal-form': 'legal-forms',
        'payment-method': 'payment-methods',
        'project-state': 'project-states',
        'project-type': 'project-types',
        'regions': 'regions',
        'project-scope': 'project-scopes',
        'sector': 'sectors',
        'serie': 'series',
        'social-entity': 'social-entities',
        'strategy': 'strategies',
        'task-state': 'task-states',
        'user-festive': 'user-festives',
        'year': 'years'
      };

      // Manual display name configuration
      // displayName: plural form shown in lists and titles
      // displayNameSingular: singular form shown in "Create" buttons and single entity operations
      const displayNames = {
        'bank-accounts': { 
          displayName: 'Comptes bancaris', 
          displayNameSingular: 'Compte bancari' 
        },
        'contact-type': { 
          displayName: 'Tipus de contacte', 
          displayNameSingular: 'Tipus de contacte' 
        },
        'dedication-type': { 
          displayName: 'Tipus de dedicació', 
          displayNameSingular: 'Tipus de dedicació' 
        },
        'expense-type': { 
          displayName: 'Tipus de despesa', 
          displayNameSingular: 'Tipus de despesa' 
        },
        'income-type': { 
          displayName: 'Tipus d\'ingrés', 
          displayNameSingular: 'Tipus d\'ingrés' 
        },
        'legal-form': { 
          displayName: 'Formes jurídiques', 
          displayNameSingular: 'Forma jurídica' 
        },
        'payment-method': { 
          displayName: 'Mètodes de pagament', 
          displayNameSingular: 'Mètode de pagament' 
        },
        'project-state': { 
          displayName: 'Estats de projecte', 
          displayNameSingular: 'Estat de projecte' 
        },
        'project-type': { 
          displayName: 'Tipus de projecte', 
          displayNameSingular: 'Tipus de projecte' 
        },
        'regions': { 
          displayName: 'Regions', 
          displayNameSingular: 'Regió' 
        },
        'project-scope': { 
          displayName: 'Àmbits de projecte', 
          displayNameSingular: 'Àmbit de projecte' 
        },
        'sector': { 
          displayName: 'Sectors', 
          displayNameSingular: 'Sector' 
        },
        'serie': { 
          displayName: 'Sèries', 
          displayNameSingular: 'Sèrie' 
        },
        'social-entity': { 
          displayName: 'Entitats socials', 
          displayNameSingular: 'Entitat social' 
        },
        'strategy': { 
          displayName: 'Estratègies', 
          displayNameSingular: 'Estratègia' 
        },
        'task-state': { 
          displayName: 'Estats de tasca', 
          displayNameSingular: 'Estat de tasca' 
        },
        'user-festive': { 
          displayName: 'Festius d\'usuari', 
          displayNameSingular: 'Festiu d\'usuari' 
        },
        'year': { 
          displayName: 'Anys', 
          displayNameSingular: 'Any' 
        }
      };

      const entitiesMetadata = [];

      for (const [entityName, apiPath] of Object.entries(adminEntities)) {
        try {
          // Read the settings.json file for each entity
          const settingsPath = path.join(
            strapi.dir,
            'api',
            entityName,
            'models',
            `${entityName}.settings.json`
          );

          if (!fs.existsSync(settingsPath)) {
            console.warn(`Settings file not found for entity: ${entityName}`);
            continue;
          }

          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

          // Get display names from manual configuration or fallback to settings
          const displayNameConfig = displayNames[entityName] || {};
          const fallbackDisplayName = settings.info.name || entityName;

          // Extract relevant metadata
          const metadata = {
            name: entityName,
            apiPath: apiPath,
            displayName: displayNameConfig.displayName || fallbackDisplayName,
            displayNameSingular: displayNameConfig.displayNameSingular || displayNameConfig.displayName || fallbackDisplayName,
            collectionName: settings.collectionName,
            attributes: {}
          };

          // Process attributes
          if (settings.attributes) {
            for (const [attrName, attrConfig] of Object.entries(settings.attributes)) {
              // Skip timestamps and internal fields for form generation
              if (attrName === 'created_at' || attrName === 'updated_at' || 
                  attrName === 'published_at' || attrName === 'created_by' || 
                  attrName === 'updated_by') {
                continue;
              }

              metadata.attributes[attrName] = {
                type: attrConfig.type,
                required: attrConfig.required || false,
                unique: attrConfig.unique || false,
                default: attrConfig.default,
              };

              // Add enum values if it's an enumeration
              if (attrConfig.type === 'enumeration' && attrConfig.enum) {
                metadata.attributes[attrName].enum = attrConfig.enum;
              }

              // Add relation info if it's a relation
              if (attrConfig.model) {
                metadata.attributes[attrName].model = attrConfig.model;
                metadata.attributes[attrName].relationType = 'manyToOne';
                
                // Handle plugin relations (e.g., users-permissions)
                if (attrConfig.plugin) {
                  metadata.attributes[attrName].plugin = attrConfig.plugin;
                }
              }

              // Add validation info
              if (attrConfig.min !== undefined) metadata.attributes[attrName].min = attrConfig.min;
              if (attrConfig.max !== undefined) metadata.attributes[attrName].max = attrConfig.max;
              if (attrConfig.minLength !== undefined) metadata.attributes[attrName].minLength = attrConfig.minLength;
              if (attrConfig.maxLength !== undefined) metadata.attributes[attrName].maxLength = attrConfig.maxLength;
            }
          }

          entitiesMetadata.push(metadata);
        } catch (error) {
          console.error(`Error processing entity ${entityName}:`, error);
        }
      }

      // Extend entityToApiPath with common non-admin entities used in relations
      const extendedEntityToApiPath = {
        ...adminEntities,
        'festive-type': 'festive-types',
        'user': 'users' // For users-permissions plugin
      };

      return {
        entities: entitiesMetadata,
        entityToApiPath: extendedEntityToApiPath
      };
    } catch (error) {
      console.error('Error in adminEntities:', error);
      return ctx.badRequest('Error fetching entity metadata', { error: error.message });
    }
  }
};

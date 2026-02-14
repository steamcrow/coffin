// ================================
// Coffin Canyon - Shared UI Components
// File: rules/ui/cc_components.js
// Version: 1.0.0
// 
// Reusable components for all CC apps:
// - Stepper (wizard navigation)
// - Step Page (card layout)
// - Picker List (selectable items)
// - Summary Panel (totals + validation)
// ================================

const CCComponents = (function() {
  'use strict';

  // ================================
  // UTILITIES
  // ================================
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function el(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') {
        element.className = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else {
        element.setAttribute(key, value);
      }
    });
    
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
    
    return element;
  }

  // ================================
  // COMPONENT: Stepper
  // ================================
  const Stepper = {
    /**
     * Creates a stepper navigation component
     * @param {Array} steps - Array of step objects: {id, title, icon, complete, locked}
     * @param {String} activeStepId - ID of current active step
     * @param {Function} onStepClick - Callback when step is clicked: (stepId) => {}
     * @returns {HTMLElement}
     */
    render(steps, activeStepId, onStepClick) {
      const container = el('div', { class: 'cc-stepper' });
      
      steps.forEach((step, index) => {
        const isActive = step.id === activeStepId;
        const isComplete = step.complete || false;
        const isLocked = step.locked || false;
        
        const classes = ['cc-stepper-step'];
        if (isActive) classes.push('active');
        if (isComplete) classes.push('complete');
        if (isLocked) classes.push('locked');
        
        const stepEl = el('button', {
          class: classes.join(' '),
          type: 'button',
          disabled: isLocked,
          onclick: () => !isLocked && onStepClick && onStepClick(step.id)
        }, [
          el('div', { class: 'cc-stepper-step-icon' }, [
            isComplete ? '✓' : (step.icon || (index + 1).toString())
          ]),
          el('div', { class: 'cc-stepper-step-label' }, [step.title])
        ]);
        
        container.appendChild(stepEl);
        
        // Add connector between steps
        if (index < steps.length - 1) {
          container.appendChild(
            el('div', { class: 'cc-stepper-connector' })
          );
        }
      });
      
      return container;
    }
  };

  // ================================
  // COMPONENT: Step Page
  // ================================
  const StepPage = {
    /**
     * Creates a step page card layout
     * @param {Object} config - {title, hint, bodyHTML, actions}
     * @returns {HTMLElement}
     */
    render(config) {
      const { title, hint, bodyHTML, actions = [] } = config;
      
      const page = el('div', { class: 'cc-step-page' });
      
      // Header
      if (title || hint) {
        const header = el('div', { class: 'cc-step-page-header' });
        
        if (title) {
          header.appendChild(
            el('h2', { class: 'cc-step-page-title' }, [title])
          );
        }
        
        if (hint) {
          header.appendChild(
            el('div', { class: 'cc-step-page-hint' }, [hint])
          );
        }
        
        page.appendChild(header);
      }
      
      // Body
      if (bodyHTML) {
        const body = el('div', { class: 'cc-step-page-body' });
        body.innerHTML = bodyHTML;
        page.appendChild(body);
      }
      
      // Footer (actions)
      if (actions.length > 0) {
        const footer = el('div', { class: 'cc-step-page-footer' });
        
        actions.forEach(action => {
          const btnClasses = ['cc-btn'];
          if (action.variant) btnClasses.push(`cc-btn-${action.variant}`);
          if (action.block) btnClasses.push('cc-btn-block');
          
          const btnChildren = [];
          if (action.icon) {
            btnChildren.push(action.icon + ' ');
          }
          btnChildren.push(action.label);
          
          const btn = el('button', {
            class: btnClasses.join(' '),
            type: 'button',
            onclick: action.onClick
          }, btnChildren);
          
          footer.appendChild(btn);
        });
        
        page.appendChild(footer);
      }
      
      return page;
    }
  };

  // ================================
  // COMPONENT: Picker List
  // ================================
  const PickerList = {
    /**
     * Creates a tappable list for selecting items
     * @param {Array} items - Array of items: {id, title, subtitle, meta, badge, cost}
     * @param {Array} selectedIds - Array of selected item IDs
     * @param {Function} onSelect - Callback: (itemId, item) => {}
     * @param {Object} options - {multiSelect, showCost, emptyMessage}
     * @returns {HTMLElement}
     */
    render(items, selectedIds = [], onSelect, options = {}) {
      const {
        multiSelect = false,
        showCost = true,
        emptyMessage = 'No items available'
      } = options;
      
      const list = el('div', { class: 'cc-picker-list' });
      
      if (!items || items.length === 0) {
        list.appendChild(
          el('div', { class: 'cc-picker-list-empty' }, [emptyMessage])
        );
        return list;
      }
      
      items.forEach(item => {
        const isSelected = selectedIds.includes(item.id);
        
        const classes = ['cc-picker-list-item'];
        if (isSelected) classes.push('selected');
        
        const itemEl = el('div', {
          class: classes.join(' '),
          onclick: () => onSelect && onSelect(item.id, item)
        });
        
        // Main content area
        const content = el('div', { class: 'cc-picker-list-item-content' });
        
        // Left side (title/subtitle)
        const leftSide = el('div', { class: 'cc-picker-list-item-left' });
        
        if (item.title) {
          leftSide.appendChild(
            el('div', { class: 'cc-picker-list-item-title' }, [item.title])
          );
        }
        
        if (item.subtitle) {
          leftSide.appendChild(
            el('div', { class: 'cc-picker-list-item-subtitle' }, [item.subtitle])
          );
        }
        
        if (item.meta) {
          leftSide.appendChild(
            el('div', { class: 'cc-picker-list-item-meta' }, [item.meta])
          );
        }
        
        content.appendChild(leftSide);
        
        // Right side (badges/cost)
        const rightSide = el('div', { class: 'cc-picker-list-item-right' });
        
        if (item.badge) {
          rightSide.appendChild(
            el('span', { class: 'cc-badge' }, [item.badge])
          );
        }
        
        if (showCost && typeof item.cost !== 'undefined') {
          rightSide.appendChild(
            el('div', { class: 'cc-picker-list-item-cost' }, [
              `${item.cost} ₤`
            ])
          );
        }
        
        content.appendChild(rightSide);
        itemEl.appendChild(content);
        
        // Selection indicator
        if (multiSelect || isSelected) {
          const indicator = el('div', { class: 'cc-picker-list-item-indicator' }, [
            multiSelect 
              ? el('i', { class: isSelected ? 'fa fa-check-square' : 'fa fa-square' })
              : el('i', { class: 'fa fa-check' })
          ]);
          itemEl.insertBefore(indicator, content);
        }
        
        list.appendChild(itemEl);
      });
      
      return list;
    }
  };

  // ================================
  // COMPONENT: Summary Panel
  // ================================
  const SummaryPanel = {
    /**
     * Creates a summary panel with totals and validation
     * @param {Object} config - {title, totals, validation, actions}
     * @returns {HTMLElement}
     */
    render(config) {
      const { title = 'Summary', totals = [], validation = {}, actions = [] } = config;
      
      const panel = el('div', { class: 'cc-summary-panel' });
      
      // Title
      if (title) {
        panel.appendChild(
          el('div', { class: 'cc-summary-panel-title' }, [title])
        );
      }
      
      // Totals section
      if (totals.length > 0) {
        const totalsContainer = el('div', { class: 'cc-summary-totals' });
        
        totals.forEach(total => {
          const row = el('div', { class: 'cc-summary-total-row' });
          
          row.appendChild(
            el('div', { class: 'cc-summary-total-label' }, [total.label])
          );
          
          const valueClasses = ['cc-summary-total-value'];
          if (total.highlight) valueClasses.push('highlight');
          if (total.warning) valueClasses.push('warning');
          if (total.error) valueClasses.push('error');
          
          row.appendChild(
            el('div', { class: valueClasses.join(' ') }, [total.value])
          );
          
          totalsContainer.appendChild(row);
        });
        
        panel.appendChild(totalsContainer);
      }
      
      // Validation section
      if (validation.warnings?.length > 0 || validation.errors?.length > 0) {
        const validationContainer = el('div', { class: 'cc-summary-validation' });
        
        if (validation.errors?.length > 0) {
          validation.errors.forEach(error => {
            validationContainer.appendChild(
              el('div', { class: 'cc-validation-error' }, [
                el('i', { class: 'fa fa-exclamation-circle' }),
                ` ${error}`
              ])
            );
          });
        }
        
        if (validation.warnings?.length > 0) {
          validation.warnings.forEach(warning => {
            validationContainer.appendChild(
              el('div', { class: 'cc-validation-warning' }, [
                el('i', { class: 'fa fa-exclamation-triangle' }),
                ` ${warning}`
              ])
            );
          });
        }
        
        panel.appendChild(validationContainer);
      }
      
      // Actions section
      if (actions.length > 0) {
        const actionsContainer = el('div', { class: 'cc-summary-actions' });
        
        actions.forEach(action => {
          const btnClasses = ['cc-btn'];
          if (action.variant) btnClasses.push(`cc-btn-${action.variant}`);
          if (action.block) btnClasses.push('cc-btn-block');
          if (action.disabled) btnClasses.push('disabled');
          
          const btnChildren = [];
          if (action.icon) {
            btnChildren.push(action.icon + ' ');
          }
          btnChildren.push(action.label);
          
          const btn = el('button', {
            class: btnClasses.join(' '),
            type: 'button',
            disabled: action.disabled || false,
            onclick: action.onClick
          }, btnChildren);
          
          actionsContainer.appendChild(btn);
        });
        
        panel.appendChild(actionsContainer);
      }
      
      return panel;
    }
  };

  // ================================
  // COMPONENT: App Shell
  // ================================
  const AppShell = {
    /**
     * Creates standard app shell wrapper
     * @param {Object} config - {title, subtitle, actions, content}
     * @returns {HTMLElement}
     */
    render(config) {
      const { title, subtitle, actions = [], content } = config;
      
      const shell = el('div', { class: 'cc-app-shell' });
      
      // Header
      const header = el('div', { class: 'cc-app-header' });
      
      const headerLeft = el('div');
      if (title) {
        headerLeft.appendChild(
          el('h1', { class: 'cc-app-title' }, [title])
        );
      }
      if (subtitle) {
        headerLeft.appendChild(
          el('div', { class: 'cc-app-subtitle' }, [subtitle])
        );
      }
      header.appendChild(headerLeft);
      
      // Header actions
      if (actions.length > 0) {
        const headerRight = el('div', { class: 'cc-app-header-actions' });
        
        actions.forEach(action => {
          const btnChildren = [];
          if (action.icon) {
            btnChildren.push(el('i', { class: action.icon }));
          } else if (action.label) {
            btnChildren.push(action.label);
          }
          
          const btn = el('button', {
            class: 'cc-btn cc-btn-sm',
            type: 'button',
            title: action.title || action.label,
            onclick: action.onClick
          }, btnChildren);
          
          headerRight.appendChild(btn);
        });
        
        header.appendChild(headerRight);
      }
      
      shell.appendChild(header);
      
      // Content
      if (content) {
        if (typeof content === 'string') {
          const contentDiv = el('div', { class: 'cc-app-content' });
          contentDiv.innerHTML = content;
          shell.appendChild(contentDiv);
        } else if (content instanceof Node) {
          shell.appendChild(content);
        }
      }
      
      return shell;
    }
  };

  // ================================
  // PUBLIC API
  // ================================
  return {
    Stepper,
    StepPage,
    PickerList,
    SummaryPanel,
    AppShell,
    
    // Utilities exposed for convenience
    utils: {
      esc,
      el
    }
  };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CCComponents;
}

// Global export
if (typeof window !== 'undefined') {
  window.CCComponents = CCComponents;
}

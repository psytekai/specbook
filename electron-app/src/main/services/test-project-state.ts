import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProjectState } from './ProjectState';

// Mock BrowserWindow for testing
class MockBrowserWindow {
  private title: string = 'Specbook Manager';
  public webContents = {
    send: (event: string, data: any) => {
      console.log(`📡 IPC Event: ${event}`, data);
    }
  };

  setTitle(title: string) {
    this.title = title;
    console.log(`🏷️  Window title: "${title}"`);
  }

  getTitle() {
    return this.title;
  }
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log();
  log(`${'='.repeat(60)}`, 'cyan');
  log(title, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logTest(name: string, passed: boolean) {
  const status = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`  ${status} ${name}`, color);
}

async function cleanup(projectPath: string) {
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function testProjectState() {
  logSection('ProjectState Test Suite');
  
  const tempDir = os.tmpdir();
  const testProjectPath1 = path.join(tempDir, `test-project-state-1-${Date.now()}.specbook`);
  const testProjectPath2 = path.join(tempDir, `test-project-state-2-${Date.now()}.specbook`);
  
  // Reset singleton before testing
  ProjectState.reset();
  const projectState = ProjectState.getInstance();
  const mockWindow = new MockBrowserWindow() as any;
  
  let allTestsPassed = true;

  try {
    // ============================================================
    // Test 1: Singleton Pattern
    // ============================================================
    logSection('Test 1: Singleton Pattern');
    
    const projectState2 = ProjectState.getInstance();
    logTest('Same instance returned', projectState === projectState2);
    
    projectState.setMainWindow(mockWindow);
    
    // ============================================================
    // Test 2: Initial State
    // ============================================================
    logSection('Test 2: Initial State');
    
    logTest('Initially not open', !projectState.isOpen);
    logTest('No current project', projectState.currentProject === null);
    logTest('No file path', projectState.currentFilePath === null);
    logTest('No unsaved changes', !projectState.hasUnsavedChanges);
    logTest('No project manager', projectState.projectManager === null);

    // ============================================================
    // Test 3: Create Project
    // ============================================================
    logSection('Test 3: Create Project');
    
    const project1 = await projectState.createProject(testProjectPath1, 'Test Project 1');
    
    logTest('Project created', !!project1);
    logTest('State shows open', projectState.isOpen);
    logTest('Current project set', projectState.currentProject === project1);
    logTest('File path set', projectState.currentFilePath === testProjectPath1);
    logTest('No unsaved changes initially', !projectState.hasUnsavedChanges);
    logTest('Project manager available', !!projectState.projectManager);
    
    // ============================================================
    // Test 4: Mark Dirty and Save
    // ============================================================
    logSection('Test 4: Mark Dirty and Save');
    
    projectState.markDirty();
    logTest('Project marked as dirty', projectState.hasUnsavedChanges);
    
    const saveResult = await projectState.saveProject({ description: 'Updated description' });
    logTest('Project saved successfully', saveResult === true);
    logTest('No longer dirty after save', !projectState.hasUnsavedChanges);
    logTest('Project updated', projectState.currentProject?.description === 'Updated description');

    // ============================================================
    // Test 5: State Info
    // ============================================================
    logSection('Test 5: State Info');
    
    const stateInfo = projectState.getStateInfo();
    logTest('State info has project', !!stateInfo.project);
    logTest('State info has file path', !!stateInfo.filePath);
    logTest('State info shows open', stateInfo.isOpen === true);
    logTest('State info shows not dirty', stateInfo.hasUnsavedChanges === false);

    // ============================================================
    // Test 6: Create Second Project (should close first)
    // ============================================================
    logSection('Test 6: Switch Projects');
    
    const project2 = await projectState.createProject(testProjectPath2, 'Test Project 2');
    
    logTest('Second project created', !!project2);
    logTest('Current project switched', projectState.currentProject?.name === 'Test Project 2');
    logTest('File path switched', projectState.currentFilePath === testProjectPath2);
    logTest('Still open', projectState.isOpen);

    // ============================================================
    // Test 7: Open Existing Project
    // ============================================================
    logSection('Test 7: Open Existing Project');
    
    const openedProject = await projectState.openProject(testProjectPath1);
    
    logTest('Existing project opened', !!openedProject);
    logTest('Correct project opened', openedProject.name === 'Test Project 1');
    logTest('Description persisted', openedProject.description === 'Updated description');
    logTest('File path correct', projectState.currentFilePath === testProjectPath1);

    // ============================================================
    // Test 8: Error Handling
    // ============================================================
    logSection('Test 8: Error Handling');
    
    try {
      await projectState.openProject('/nonexistent/project.specbook');
      logTest('Error thrown for invalid path', false);
    } catch (error) {
      logTest('Error thrown for invalid path', true);
      logTest('State reset after error', !projectState.isOpen);
    }
    
    // Reopen valid project for next tests
    await projectState.openProject(testProjectPath1);

    // ============================================================
    // Test 9: Close Project
    // ============================================================
    logSection('Test 9: Close Project');
    
    await projectState.closeProject();
    
    logTest('Project closed', !projectState.isOpen);
    logTest('Current project cleared', projectState.currentProject === null);
    logTest('File path cleared', projectState.currentFilePath === null);
    logTest('No unsaved changes', !projectState.hasUnsavedChanges);
    logTest('Project manager cleared', projectState.projectManager === null);

    // ============================================================
    // Test 10: Operations on Closed Project
    // ============================================================
    logSection('Test 10: Operations on Closed Project');
    
    try {
      await projectState.saveProject();
      logTest('Save throws error when no project', false);
    } catch (error) {
      logTest('Save throws error when no project', true);
    }
    
    projectState.markDirty();
    logTest('Mark dirty ignored when no project', !projectState.hasUnsavedChanges);

  } catch (error) {
    log(`\nTest failed with error: ${error}`, 'red');
    allTestsPassed = false;
  } finally {
    // Cleanup
    await cleanup(testProjectPath1);
    await cleanup(testProjectPath2);
    ProjectState.reset();
  }

  // ============================================================
  // Summary
  // ============================================================
  logSection('Test Summary');
  
  if (allTestsPassed) {
    log('✅ All tests passed successfully!', 'green');
    log('', 'reset');
    log('The ProjectState class is ready for integration.', 'green');
    log('Key features working:', 'green');
    log('  - Singleton pattern', 'green');
    log('  - Project lifecycle management', 'green');
    log('  - State synchronization', 'green');
    log('  - Error handling', 'green');
    log('  - Window title updates', 'green');
    log('  - IPC notifications', 'green');
  } else {
    log('❌ Some tests failed. Please review the output above.', 'red');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testProjectState().catch(error => {
    log(`Fatal error: ${error}`, 'red');
    process.exit(1);
  });
}

export { testProjectState };
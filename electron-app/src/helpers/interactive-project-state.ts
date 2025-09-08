import * as readline from 'readline';
import * as path from 'path';
import * as os from 'os';
import { ProjectState } from './ProjectState';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

// Mock BrowserWindow for testing
class MockBrowserWindow {
  public webContents = {
    send: (event: string, data: any) => {
      console.log(`🎯 IPC Event: ${event}`);
      console.log('   Data:', JSON.stringify(data, null, 2));
    }
  };

  setTitle(title: string) {
    console.log(`📝 Window Title: "${title}"`);
  }
}

async function showMenu() {
  console.log('\n=== ProjectState Interactive Test ===');
  console.log('1. Show current state');
  console.log('2. Create new project');
  console.log('3. Open existing project'); 
  console.log('4. Save project');
  console.log('5. Mark project dirty');
  console.log('6. Close project');
  console.log('7. Test error handling');
  console.log('0. Exit');
  console.log('=====================================');
}

async function showCurrentState(projectState: ProjectState) {
  const state = projectState.getStateInfo();
  
  console.log('\n📊 Current State:');
  console.log(`   Is Open: ${state.isOpen}`);
  console.log(`   Project: ${state.project?.name || 'None'}`);
  console.log(`   File Path: ${state.filePath || 'None'}`);
  console.log(`   Has Unsaved Changes: ${state.hasUnsavedChanges}`);
  
  if (state.project) {
    console.log(`   Project ID: ${state.project.id}`);
    console.log(`   Product Count: ${state.project.productCount}`);
    console.log(`   Created: ${state.project.createdAt}`);
    console.log(`   Updated: ${state.project.updatedAt}`);
    if (state.project.description) {
      console.log(`   Description: ${state.project.description}`);
    }
  }
}

async function createProject(projectState: ProjectState) {
  const name = await question('Project name: ');
  const location = await question('Project location (press Enter for temp): ') || os.tmpdir();
  const projectPath = path.join(location, `${name.replace(/\s+/g, '-')}.specbook`);
  
  try {
    console.log(`\n🔨 Creating project at: ${projectPath}`);
    const project = await projectState.createProject(projectPath, name);
    console.log(`✅ Project created successfully!`);
    console.log(`   ID: ${project.id}`);
    console.log(`   Name: ${project.name}`);
  } catch (error) {
    console.error(`❌ Error creating project: ${error}`);
  }
}

async function openProject(projectState: ProjectState) {
  const projectPath = await question('Project path (.specbook): ');
  
  try {
    console.log(`\n📂 Opening project: ${projectPath}`);
    const project = await projectState.openProject(projectPath);
    console.log(`✅ Project opened successfully!`);
    console.log(`   Name: ${project.name}`);
    console.log(`   Products: ${project.productCount}`);
  } catch (error) {
    console.error(`❌ Error opening project: ${error}`);
  }
}

async function saveProject(projectState: ProjectState) {
  if (!projectState.isOpen) {
    console.log('❌ No project is open');
    return;
  }
  
  const description = await question('New description (optional): ');
  const updates = description ? { description } : undefined;
  
  try {
    console.log('\n💾 Saving project...');
    const result = await projectState.saveProject(updates);
    if (result) {
      console.log('✅ Project saved successfully!');
    } else {
      console.log('❌ Failed to save project');
    }
  } catch (error) {
    console.error(`❌ Error saving project: ${error}`);
  }
}

async function markDirty(projectState: ProjectState) {
  if (!projectState.isOpen) {
    console.log('❌ No project is open');
    return;
  }
  
  console.log('\n📝 Marking project as dirty...');
  projectState.markDirty();
  console.log('✅ Project marked as having unsaved changes');
}

async function closeProject(projectState: ProjectState) {
  if (!projectState.isOpen) {
    console.log('❌ No project is open');
    return;
  }
  
  console.log('\n🔒 Closing project...');
  await projectState.closeProject();
  console.log('✅ Project closed successfully');
}

async function testErrorHandling(projectState: ProjectState) {
  console.log('\n⚠️  Testing error handling...');
  
  try {
    await projectState.openProject('/nonexistent/project.specbook');
    console.log('❌ Should have thrown an error');
  } catch (error) {
    console.log(`✅ Error caught correctly: ${error}`);
  }
  
  // Test saving when no project is open
  if (!projectState.isOpen) {
    try {
      await projectState.saveProject();
      console.log('❌ Should have thrown an error');
    } catch (error) {
      console.log(`✅ Save error caught correctly: ${error}`);
    }
  }
}

async function main() {
  console.log('🚀 ProjectState Interactive Test Tool');
  console.log('=====================================');
  
  // Reset and get singleton instance
  ProjectState.reset();
  const projectState = ProjectState.getInstance();
  const mockWindow = new MockBrowserWindow() as any;
  projectState.setMainWindow(mockWindow);
  
  while (true) {
    await showMenu();
    const choice = await question('\nEnter choice: ');
    
    switch (choice) {
      case '1':
        await showCurrentState(projectState);
        break;
      case '2':
        await createProject(projectState);
        break;
      case '3':
        await openProject(projectState);
        break;
      case '4':
        await saveProject(projectState);
        break;
      case '5':
        await markDirty(projectState);
        break;
      case '6':
        await closeProject(projectState);
        break;
      case '7':
        await testErrorHandling(projectState);
        break;
      case '0':
        console.log('👋 Goodbye!');
        await projectState.closeProject();
        rl.close();
        process.exit(0);
      default:
        console.log('❌ Invalid choice');
    }
    
    // Always show current state after an operation
    if (choice !== '1') {
      await showCurrentState(projectState);
    }
  }
}

main().catch(console.error);
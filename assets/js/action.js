document.addEventListener('DOMContentLoaded', () => {
  const llmSettings = {};
  const queryParams = new URLSearchParams(window.location.search);

  // Iterate over all query parameters found in the URL
  for (const [key, value] of queryParams.entries()) {
    // Basic type conversion for known numeric fields
    if (['temperature', 'top_p'].includes(key)) {
      const numValue = parseFloat(value);
      llmSettings[key] = isNaN(numValue) ? value : numValue;
    } else if (key === 'max_completion_tokens') {
      const numValue = parseInt(value, 10);
      llmSettings[key] = isNaN(numValue) ? value : numValue;
    } else {
      llmSettings[key] = value;
    }
  }
  // Make the parameters globally available for other scripts
  window.llmSettings = llmSettings;
  console.log('LLM Settings:', window.llmSettings)

  // Check whether the page has the container.
  const contentContainer = document.querySelector('.container-md.markdown-body');
  if (!contentContainer) {
    console.error('Main content container (.container-md.markdown-body) not found.');
    return;
  }
  // Check whether the page has a header.
  const h1Element = contentContainer.querySelector('h1');
  if (!h1Element) {
    console.error('H1 element not found. UI elements might be misplaced.');
  }

  // 1. Create a wrapper for the dialogue content (will be populated by updateDisplayState)
  const dialogueWrapper = document.createElement('div');
  dialogueWrapper.id = 'dialogue-content-wrapper';
  dialogueWrapper.style.paddingBottom = '20px';

  // 2. Create the textarea for editing
  const textarea = document.createElement('textarea');
  textarea.className = 'form-control';
  textarea.style.width = '100%';
  textarea.style.minHeight = '830px';
  textarea.style.display = 'none'; // Initially hidden
  textarea.style.setProperty('border', '1px solid lightgrey', 'important');
  textarea.style.padding = '10px';

  // 3. Create container and button for file picking
  const filePickerContainer = document.createElement('div');
  filePickerContainer.id = 'file-picker-container';
  filePickerContainer.style.width = '100%';
  filePickerContainer.style.minHeight = '830px'; // Match textarea height
  filePickerContainer.style.display = 'flex'; // Changed from 'none' to 'flex' for centering
  filePickerContainer.style.justifyContent = 'center';
  filePickerContainer.style.alignItems = 'center';
  filePickerContainer.style.padding = '20px';
  filePickerContainer.style.display = 'none'; // Initially hidden, updateDisplayState will show it

  const chooseFileButton = document.createElement('button');
  chooseFileButton.id = 'chooseFileButton';
  chooseFileButton.className = 'btn btn-primary'; // GitHub Primer style
  chooseFileButton.textContent = 'Choose File to Load Dialogue';
  chooseFileButton.style.padding = '10px 20px'; // Make button larger
  chooseFileButton.style.fontSize = '1.0rem';
  filePickerContainer.appendChild(chooseFileButton);

  // 4. Insert dynamic elements into the DOM (after H1 or fallback)
  if (h1Element) {
    h1Element.after(dialogueWrapper, textarea, filePickerContainer);
  } else {
    contentContainer.prepend(dialogueWrapper, textarea, filePickerContainer); // Fallback
  }

  // 5. Initialize localStorage:
  // If 'multilogue' is null, try to populate from static HTML. Otherwise, use existing.
  let platoTextForInit = localStorage.getItem('multilogue');
  if (platoTextForInit === null) {
    if (initialHtmlFromStatic.trim() !== '') {
      try {
        platoTextForInit = platoHtmlToPlatoText(initialHtmlFromStatic);
      } catch (e) {
        console.error("Error converting initial static HTML to Plato text:", e);
        platoTextForInit = ''; // Fallback to empty string on error
      }
    } else {
      platoTextForInit = ''; // No static content, initialize as empty
    }
    localStorage.setItem('multilogue', platoTextForInit);
  }
  // Now, localStorage.getItem('multilogue') is guaranteed to be a string (possibly empty).

  // 6. Function to update display based on localStorage content
  function updateDisplayState() {
    const currentPlatoText = localStorage.getItem('multilogue');
    // If there is some text.
    if (currentPlatoText && currentPlatoText.trim() !== '') {
      try {
        dialogueWrapper.innerHTML = platoTextToPlatoHtml(currentPlatoText);
      } catch (e) {
        console.error("Error rendering Plato text to HTML:", e);
        dialogueWrapper.innerHTML = "<p class='dialogue-error'>Error loading content. Please try editing or loading a new file.</p>";
      }
      dialogueWrapper.style.display = 'block';
      textarea.style.display = 'none';
      filePickerContainer.style.display = 'none';
      // Scroll to the bottom of the dialogue content after it's updated and shown
      dialogueWrapper.scrollIntoView({behavior: 'smooth', block: 'end'});

    } else {
      // No valid content, show file picker
      dialogueWrapper.style.display = 'none';
      textarea.style.display = 'none';
      filePickerContainer.style.display = 'flex'; // Use flex to enable centering
      dialogueWrapper.innerHTML = ''; // Clear any old content
      textarea.value = ''; // Clear textarea
    }
  }

  // Initial display update
  updateDisplayState();
  // 7. Event listener for "Choose File" button
  chooseFileButton.addEventListener('click', async () => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{
          description: 'Text Files',
          accept: {
            'text/plain': ['.txt', '.md', '.text', '.plato'],
          }
        }]
      });
      const file = await fileHandle.getFile();
      const fileContent = await file.text();

      localStorage.setItem('multilogue', fileContent);
      // No need to set textarea.value here, updateDisplayState will handle if we switch to editor
      // OR, if we want to go directly to editor:
      textarea.value = fileContent;
      dialogueWrapper.style.display = 'none';
      filePickerContainer.style.display = 'none';
      textarea.style.display = 'block';
      textarea.focus();
      // If not going directly to editor, just call updateDisplayState()
      // updateDisplayState();
    } catch (err) {
      if (err.name !== 'AbortError') { // User cancelled picker
        console.error('Error opening file:', err);
        alert(`Error opening file: ${err.message}`);
      }
    }
  });
  // 8. Event listener to switch to edit mode when dialogue content is clicked
  dialogueWrapper.addEventListener('click', () => {
    try {
      // Read directly from localStorage to ensure consistency,
      // as dialogueWrapper.innerHTML might have formatting quirks.
      const plainText = localStorage.getItem('multilogue') || '';
      // Or, if conversion from current HTML is preferred:
      // const plainText = platoHtmlToPlatoText(dialogueWrapper.innerHTML);
      textarea.value = plainText;
      dialogueWrapper.style.display = 'none';
      textarea.style.display = 'block';
      filePickerContainer.style.display = 'none';
      textarea.focus();
    } catch (e) {
      console.error("Error converting HTML to Plato text for editing:", e);
      alert("Could not switch to edit mode due to a content error.");
    }
  });

  // 9. Event listener for saving (Ctrl+Enter) in the textarea
  textarea.addEventListener('keydown', (event) => {
    if (event.ctrlKey && !event.shiftKey && event.key === 'Enter') { // Changed from Shift to Enter as per original request context
      event.preventDefault();
      const newText = textarea.value;
      localStorage.setItem('multilogue', newText);
      updateDisplayState(); // Update display, which will show dialogue or button
    }
  });
  // 10. Event listener for saving to file (Ctrl+Shift+Enter) - Always "Save As"
  document.addEventListener('keydown', async (event) => {
    if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      const textToSave = localStorage.getItem('multilogue') || '';

      if (!textToSave.trim()) {
        console.log('Ctrl+Shift+Enter: Dialogue content is empty. Nothing to save.');
        alert('Dialogue is empty. Nothing to save.');
        return; // Prevent saving an empty file
      }


      try {
        // Always prompt "Save As"
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: 'multilogue.txt', // You can customize the suggested name
          types: [{
            description: 'Text Files',
            accept: {
              'text/plain': ['.txt', '.md', '.text', '.plato'],
            },
          }],
        });

        // Create a FileSystemWritableFileStream to write to.
        const writable = await fileHandle.createWritable();

        // Write the contents of the file to the stream.
        await writable.write(textToSave);

        // Close the file and write the contents to disk.
        await writable.close();

        // If file save was successful, then update localStorage
        localStorage.setItem('multilogue', textToSave);
        updateDisplayState(); // Refresh the view

        // Optional: alert('Dialogue saved to file!');

      } catch (err) {
        // Handle errors, e.g., if the user cancels the save dialog
        if (err.name !== 'AbortError') {
          console.error('Error saving file:', err);
          alert(`Could not save file: ${err.message}`);
        }
      }
    }
  });
  // // 11. Event listener for LLM communications (Alt+Shift)
  // document.addEventListener('keydown', function (event) {
  //   if (event.altKey && event.shiftKey) {
  //     event.preventDefault();
  //
  //     const currentDialogueWrapper = document.getElementById('dialogue-content-wrapper');
  //     if (!currentDialogueWrapper) {
  //       console.error('Alt+Shift: dialogue-content-wrapper not found.');
  //       alert('Error: Could not find the dialogue content to send.');
  //       return;
  //     }
  //
  //     const htmlContent = currentDialogueWrapper.innerHTML;
  //     if (!htmlContent || htmlContent.trim() === '') {
  //       console.log('Alt+Shift: Dialogue content is empty. Nothing to send.');
  //       alert('Dialogue is empty. Please add some content first.');
  //       return;
  //     }
  //
  //     console.log('Alt+Shift pressed. Preparing to send dialogue to LLM worker...');
  //
  //     try {
  //       const cmjMessages = platoHtmlToCmj(htmlContent); // platoHtmlToCmj is global
  //
  //       const userQueryParameters = {
  //         config: window.machineConfig,
  //         settings: window.llmSettings,
  //         messages: cmjMessages
  //       };
  //
  //       console.log('Alt+Shift: Launching LLM worker with CMJ messages:', userQueryParameters);
  //       const llmWorker = new Worker(machineConfig.work);
  //
  //       llmWorker.onmessage = function (e) {
  //         console.log('Main thread: Message received from worker:', e.data);
  //         if (e.data.type === 'success') {
  //           console.log('Worker task successful. LLM Response:', e.data.data);
  //
  //           try {
  //             const llmResponseData = e.data.data;
  //             if (!llmResponseData || !llmResponseData.content || llmResponseData.content.length === 0) {
  //               console.error('LLM response is missing a message content.');
  //               alert('Received an empty or invalid response from the LLM.');
  //               return;
  //             }
  //             const desoupedText = llmSoupToText(llmResponseData.content)
  //
  //             console.log('Regular text:', desoupedText);
  //
  //             const desoupedThoughts = llmSoupToText(llmResponseData.reasoning_content)
  //
  //             console.log('Thoughts text:', desoupedThoughts);
  //
  //             const newCmjMessage = {
  //               role: llmResponseData.role,
  //               name: machineConfig.name,
  //               content: desoupedText
  //             };
  //
  //             cmjMessages.push(newCmjMessage);
  //
  //             // CmjToPlatoText is global
  //             const updatedPlatoText = CmjToPlatoText(cmjMessages);
  //             if (typeof updatedPlatoText !== 'string') {
  //               console.error('Failed to convert updated CMJ to PlatoText.');
  //               alert('Error processing the LLM response for display.');
  //               return;
  //             }
  //
  //             localStorage.setItem('multilogue', updatedPlatoText);
  //
  //             localStorage.setItem('thoughts', desoupedThoughts);
  //
  //             // --- Open or ensure the thoughts tab is open/updated ---
  //             const thoughtsPageUrl = 'thoughts.html'; // Assuming thoughts.html is in the same directory level
  //             let thoughtsTab = window.open('', 'grokThoughtsTab'); // Use a consistent name to reference the tab
  //
  //             if (!thoughtsTab || thoughtsTab.closed) {
  //               console.log('Thoughts tab not found or closed, opening new one.');
  //               thoughtsTab = window.open(thoughtsPageUrl, 'grokThoughtsTab');
  //               // If a new tab is opened, browser focus will likely shift to it.
  //             } else {
  //               // Tab exists, check if it's on the correct page or needs navigation
  //               let currentPath = '';
  //               let needsNavigation = false;
  //               try {
  //                 currentPath = thoughtsTab.location.pathname;
  //                 // Check if the current path correctly points to thoughts.html
  //                 // This handles cases like the tab being open but on 'about:blank'
  //                 if (thoughtsTab.location.href === 'about:blank' || !currentPath.endsWith(thoughtsPageUrl)) {
  //                   needsNavigation = true;
  //                 }
  //               } catch (e) {
  //                 // Cross-origin error likely means it's on 'about:blank' or a different domain if something went wrong.
  //                 console.warn('Could not access thoughtsTab.location.pathname, will attempt to navigate.');
  //                 needsNavigation = true; // Assume navigation is needed
  //               }
  //
  //               if (needsNavigation) {
  //                 console.log(`Thoughts tab needs navigation. Current href: ${thoughtsTab.location.href}. Attempting to set to ${thoughtsPageUrl}`);
  //                 try {
  //                   thoughtsTab.location.href = thoughtsPageUrl;
  //                 } catch (navError) {
  //                   console.error('Failed to navigate existing thoughts tab, trying to reopen:', navError);
  //                   // Fallback: try to open a new one, which might be blocked or create a new instance
  //                   thoughtsTab = window.open(thoughtsPageUrl, 'grokThoughtsTab');
  //                 }
  //               } else {
  //                 console.log('Thoughts tab already open and on the correct page. localStorage change will trigger its update.');
  //               }
  //             }
  //
  //             // updateDisplayState
  //             updateDisplayState();
  //             console.log('Dialogue updated with LLM response.');
  //
  //           } catch (processingError) {
  //             console.error('Error processing LLM response:', processingError);
  //             alert('An error occurred while processing the LLM response: ' + processingError.message);
  //           }
  //
  //         } else if (e.data.type === 'error') {
  //           console.error('Main thread: Error message from worker:', e.data.error);
  //           alert('Worker reported an error: ' + e.data.error);
  //         }
  //       };
  //
  //       llmWorker.onerror = function (error) {
  //         console.error('Main thread: An error occurred with the worker script:', error.message, error);
  //         alert('Failed to initialize or run worker: ' + error.message);
  //       };
  //
  //       llmWorker.postMessage(userQueryParameters);
  //       console.log('Main thread: Worker launched and CMJ messages sent.');
  //
  //     } catch (e) {
  //       console.error('Alt+Shift: Failed to process dialogue or communicate with the worker:', e);
  //       alert('Error preparing data for LLM: ' + e.message);
  //     }
  //   }
  // });
  
  // 11. Event listener for LLM communications (Alt+Shift)
  document.addEventListener('keydown', async function (event) { // <-- Add async here
    if (event.altKey && event.shiftKey) {
      event.preventDefault();
      console.log('Alt+Shift pressed. Triggering LLM interaction.');
      try {
        runMachine();
      } catch (error) { // Catch any errors from runMachine
        console.error('LLM interaction failed (runMachine):', error.message);
      }
    }
  });
  // 12 Event listener for remote trigger from Chrome extension
  window.addEventListener('runMachineCommand', async function() { // Make the function async
    console.log('Received runMachineCommand event. Triggering LLM interaction.');
    try {
      runMachine();
    } catch (error) { // Catch any errors from runMachine
      console.error('LLM interaction failed (runMachineCommand):', error.message);
    }
  });
  
  // 13. Update multilogue display from the localStorage
  window.addEventListener('localStorageChanged', function() {
    console.log('Received localStorageChanged event. Triggering multilogue update.');
    updateDisplayState();
    console.log('Dialogue updated with received multilogue.');
  });
  
  // 14. Update display when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // console.log('Page is now visible, ensuring display is up to date.');
      if (typeof updateDisplayState === 'function') {
        updateDisplayState();
      } else {
        console.warn('Page Script (visibilitychange): updateDisplayState function not found.');
      }
    }
  });
});

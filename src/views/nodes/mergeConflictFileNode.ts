import { Command, MarkdownString, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';
import { CoreCommands } from '../../constants';
import { StatusFileFormatter } from '../../git/formatters/statusFormatter';
import { GitUri } from '../../git/gitUri';
import type { GitFile } from '../../git/models/file';
import type { GitMergeStatus } from '../../git/models/merge';
import type { GitRebaseStatus } from '../../git/models/rebase';
import { relativeDir } from '../../system/path';
import type { ViewsWithCommits } from '../viewBase';
import { FileNode } from './folderNode';
import { MergeConflictCurrentChangesNode } from './mergeConflictCurrentChangesNode';
import { MergeConflictIncomingChangesNode } from './mergeConflictIncomingChangesNode';
import { ContextValues, ViewNode } from './viewNode';

export class MergeConflictFileNode extends ViewNode<ViewsWithCommits> implements FileNode {
	constructor(
		view: ViewsWithCommits,
		parent: ViewNode,
		public readonly status: GitMergeStatus | GitRebaseStatus,
		public readonly file: GitFile,
	) {
		super(GitUri.fromFile(file, status.repoPath, status.HEAD.ref), view, parent);
	}

	override toClipboard(): string {
		return this.fileName;
	}

	get baseUri(): Uri {
		return GitUri.fromFile(this.file, this.status.repoPath, this.status.mergeBase ?? 'HEAD');
	}

	get fileName(): string {
		return this.file.path;
	}

	get repoPath(): string {
		return this.status.repoPath;
	}

	getChildren(): ViewNode[] {
		return [
			new MergeConflictCurrentChangesNode(this.view, this, this.status, this.file),
			new MergeConflictIncomingChangesNode(this.view, this, this.status, this.file),
		];
	}

	getTreeItem(): TreeItem {
		const item = new TreeItem(this.label, TreeItemCollapsibleState.Collapsed);
		item.description = this.description;
		item.contextValue = `${ContextValues.File}+conflicted`;

		const tooltip = StatusFileFormatter.fromTemplate(
			`\${file}\${ \u2022 changesDetail}\${\\\\\ndirectory}\${\n\nstatus}\${ (originalPath)} in Index (staged)`,
			this.file,
		);
		const markdown = new MarkdownString(tooltip, true);
		markdown.isTrusted = true;
		markdown.supportHtml = true;

		item.tooltip = markdown;

		// Use the file icon and decorations
		item.resourceUri = this.view.container.git.getAbsoluteUri(this.file.path, this.repoPath);
		item.iconPath = ThemeIcon.File;
		item.command = this.getCommand();

		// Only cache the label/description for a single refresh
		this._label = undefined;
		this._description = undefined;

		return item;
	}

	private _description: string | undefined;
	get description() {
		if (this._description == null) {
			this._description = StatusFileFormatter.fromTemplate(
				this.view.config.formats.files.description,
				this.file,
				{
					relativePath: this.relativePath,
				},
			);
		}
		return this._description;
	}

	private _folderName: string | undefined;
	get folderName() {
		if (this._folderName == null) {
			this._folderName = relativeDir(this.uri.relativePath);
		}
		return this._folderName;
	}

	private _label: string | undefined;
	get label() {
		if (this._label == null) {
			this._label = StatusFileFormatter.fromTemplate(this.view.config.formats.files.label, this.file, {
				relativePath: this.relativePath,
			});
		}
		return this._label;
	}

	get priority(): number {
		return 0;
	}

	private _relativePath: string | undefined;
	get relativePath(): string | undefined {
		return this._relativePath;
	}
	set relativePath(value: string | undefined) {
		this._relativePath = value;
		this._label = undefined;
		this._description = undefined;
	}

	override getCommand(): Command | undefined {
		return {
			title: 'Open File',
			command: CoreCommands.Open,
			arguments: [
				this.view.container.git.getAbsoluteUri(this.file.path, this.repoPath),
				{
					preserveFocus: true,
					preview: true,
				},
			],
		};
	}
}
